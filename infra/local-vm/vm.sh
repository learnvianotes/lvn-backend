#!/usr/bin/env bash
# The local environment's VM (ADR-0036): Debian 13 under QEMU/KVM with Docker and Terraform, standing in for the AWS
# sandbox until there is an account. Settings come from infra/terraform/envs/local/.env (LVN_VM_*); the VM's files
# (disk, key, logs) live outside the repository in $LVN_VM_DIR.
#
#   infra/local-vm/vm.sh up          create on first run (downloads the image), then boot and wait for SSH
#   infra/local-vm/vm.sh ssh [cmd…]  a shell or a command in the VM, as user lvn
#   infra/local-vm/vm.sh status | stop | destroy
#   infra/local-vm/vm.sh ssh-command  the ssh command line, for rsync -e (user lvn@127.0.0.1)
#
# LVN_VM_ENV=<env> runs another environment's VM with settings from envs/<env>/.env (the AWS stand-in of ADR-0066 used
# this; it was retired with AWS, ADR-0096). Each needs its own LVN_VM_DIR and LVN_VM_SSH_PORT; a port set to `off` is
# not forwarded.
#
# Needs qemu-system-x86_64 with KVM (/dev/kvm), curl, xz, sha512sum, ssh-keygen and python3 (serves the first-boot
# configuration to the VM on 127.0.0.1 only).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
vm_env=${LVN_VM_ENV:-local}
env_file="$here/../terraform/envs/$vm_env/.env"
if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
fi

dir=${LVN_VM_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/lvn-$([ "$vm_env" = local ] || echo "$vm_env-")vm}
cpus=${LVN_VM_CPUS:-6}
memory=${LVN_VM_MEMORY_MB:-8192}
disk_size=${LVN_VM_DISK:-40G}
ssh_port=${LVN_VM_SSH_PORT:-2222}
# Where the environment is reachable on this machine: the entrance (web + API) and the S3 endpoint that pre-signed
# URLs point at, on each address listed (127.0.0.1 and, for phones, the Tailscale address). Mailpit: localhost only.
addresses=${LVN_VM_PUBLISH_ADDRESSES:-127.0.0.1}
http_port=${LVN_VM_HTTP_PORT:-8080}
s3_port=${LVN_VM_S3_PORT:-8081}
mail_port=${LVN_VM_MAIL_PORT:-8025}
# More forwards, comma-separated in QEMU's form <host address>:<host port>-:<guest port>, e.g. 127.0.0.1:4566-:4566.
forwards=${LVN_VM_FORWARDS:-}

image_base=https://cloud.debian.org/images/cloud/trixie/latest
image=debian-13-genericcloud-amd64.tar.xz
terraform_version=1.16.5
# HashiCorp Security (HashiCorp Package Signing), rotated 2026-09-09; checked against keyserver.ubuntu.com.
hashicorp_key=D55C0D1AC78A8D8126CB631CFC9CA96ACA026560

key="$dir/id_ed25519"
ssh_opts=(-i "$key" -p "$ssh_port" -o StrictHostKeyChecking=accept-new -o "UserKnownHostsFile=$dir/known_hosts" -o LogLevel=ERROR -o ConnectTimeout=5)

running() { [ -f "$dir/qemu.pid" ] && kill -0 "$(cat "$dir/qemu.pid")" 2>/dev/null; }
# shellcheck disable=SC2029  # remote commands are meant to expand here and run there
vm_ssh() { ssh "${ssh_opts[@]}" lvn@127.0.0.1 "$@"; }

create() {
  mkdir -p "$dir/cache"
  if [ ! -f "$dir/cache/$image" ]; then
    echo "==> Downloading $image"
    curl -fL --progress-bar -o "$dir/cache/$image.part" "$image_base/$image"
    mv "$dir/cache/$image.part" "$dir/cache/$image"
  fi
  curl -fsSL "$image_base/SHA512SUMS" | grep " $image\$" > "$dir/cache/$image.sha512"
  (cd "$dir/cache" && sha512sum -c --quiet "$image.sha512") || { echo "checksum mismatch for $image" >&2; rm -f "$dir/cache/$image"; exit 1; }
  echo "==> Disk ($disk_size)"
  tar -xJf "$dir/cache/$image" -C "$dir" disk.raw
  # cloud-init grows the root partition into the new space on first boot.
  truncate -s "$disk_size" "$dir/disk.raw"
  [ -f "$key" ] || ssh-keygen -q -t ed25519 -N '' -C lvn-local-vm -f "$key"
  mkdir -p "$dir/seed"
  printf 'instance-id: lvn-%s-1\nlocal-hostname: lvn-%s\n' "$vm_env" "$vm_env" > "$dir/seed/meta-data"
  sed -e "s|@SSH_PUBLIC_KEY@|$(cat "$key.pub")|" -e "s|@HASHICORP_KEY_FINGERPRINT@|$hashicorp_key|" \
    -e "s|@TERRAFORM_VERSION@|$terraform_version|" -e "s|@HOSTNAME@|lvn-$vm_env|" "$here/user-data.yaml" > "$dir/seed/user-data"
}

boot() {
  local fwd="hostfwd=tcp:127.0.0.1:$ssh_port-:22" a f seed=() server=
  [ "$mail_port" = off ] || fwd+=",hostfwd=tcp:127.0.0.1:$mail_port-:8025"
  IFS=, read -ra list <<< "$addresses"
  for a in "${list[@]}"; do
    [ "$http_port" = off ] || fwd+=",hostfwd=tcp:$a:$http_port-:80"
    [ "$s3_port" = off ] || fwd+=",hostfwd=tcp:$a:$s3_port-:9000"
  done
  IFS=, read -ra list <<< "$forwards"
  for f in "${list[@]}"; do fwd+=",hostfwd=tcp:$f"; done
  if [ ! -f "$dir/provisioned" ]; then
    # First boot: cloud-init fetches meta-data and user-data from this server (QEMU's 10.0.2.2 is the host's loopback).
    local port
    port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
    python3 -m http.server --bind 127.0.0.1 --directory "$dir/seed" "$port" > "$dir/seed.log" 2>&1 &
    server=$!
    seed=(-smbios "type=1,serial=ds=nocloud;s=http://10.0.2.2:$port/")
  fi
  echo "==> Booting lvn-$vm_env (${cpus} CPUs, ${memory} MiB$([ "$http_port" = off ] || echo "; entrance on ${addresses} port $http_port"))"
  qemu-system-x86_64 -name "lvn-$vm_env" -machine q35,accel=kvm -cpu host -smp "$cpus" -m "$memory" \
    -drive "file=$dir/disk.raw,format=raw,if=virtio,cache=none,discard=unmap" \
    -netdev "user,id=net0,$fwd" -device virtio-net-pci,netdev=net0 -device virtio-rng-pci \
    "${seed[@]}" -display none -serial "file:$dir/console.log" -pidfile "$dir/qemu.pid" -daemonize
  echo "==> Waiting for SSH"
  for _ in $(seq 1 120); do vm_ssh true 2>/dev/null && break; sleep 2; done
  vm_ssh true || { echo "no SSH after 4 minutes; see $dir/console.log" >&2; exit 1; }
  if [ -n "$server" ]; then
    echo "==> First-boot setup (packages, Docker, Terraform $terraform_version)"
    vm_ssh 'sudo cloud-init status --wait >/dev/null; sudo cloud-init status --long' || true
    kill "$server" 2>/dev/null || true
    vm_ssh 'terraform version | head -1 && docker version --format "Docker {{.Server.Version}}"' && touch "$dir/provisioned"
  fi
}

case ${1:-} in
  up)
    running && { echo "Already running."; exit 0; }
    [ -f "$dir/disk.raw" ] || create
    boot
    echo "Ready: $([ "$vm_env" = local ] || echo "LVN_VM_ENV=$vm_env ")infra/local-vm/vm.sh ssh"
    ;;
  ssh)
    shift
    # A terminal for an interactive shell only, so commands can stream data (docker save | vm.sh ssh docker load).
    [ $# -eq 0 ] && exec ssh "${ssh_opts[@]}" -t lvn@127.0.0.1
    exec ssh "${ssh_opts[@]}" lvn@127.0.0.1 "$@"
    ;;
  ssh-command) echo "ssh ${ssh_opts[*]}" ;;
  status)
    if running; then echo "running (pid $(cat "$dir/qemu.pid")), files in $dir"; else echo "stopped, files in $dir"; fi
    ;;
  stop)
    running || { echo "Not running."; exit 0; }
    vm_ssh 'sudo systemctl poweroff' 2>/dev/null || true
    for _ in $(seq 1 60); do running || break; sleep 1; done
    running && kill "$(cat "$dir/qemu.pid")"
    rm -f "$dir/qemu.pid"
    echo "Stopped."
    ;;
  destroy)
    running && "$0" stop
    read -rp "Delete the VM's disk and keys in $dir (everything in the $vm_env environment)? [y/N] " yes
    [ "$yes" = y ] && rm -rf "$dir/disk.raw" "$dir/seed" "$dir/provisioned" "$dir/known_hosts" "$dir"/id_ed25519* && echo "Deleted (the image cache stays)."
    ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
