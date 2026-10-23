---
id: 3bfc9b4b-4e1b-7c0d-ba8a-e0594e56547a
key: topic:cryptography/ch3
subject: cryptography
topic: ch3
title: Classical Cryptography
slug: classical-cryptography
order: 1
---

Pencil-and-paper ciphers, monoalphabetic substitution, polyalphabetic Vigenère grids, and transposition patterns.

# 1. Substitution Ciphers &amp; Frequency Analysis

> [!INFO]
>
> • <strong>Monoalphabetic Substitution:</strong> Maps each letter of the alphabet to a unique counterpart in a scrambled alphabet. E.g., \`A\` always maps to \`Q\`, \`B\` always maps to \`W\`, etc.<br> • <strong>Vulnerability (Frequency Analysis):</strong> In any language, letters appear with predictable frequencies. In English, \`E\` (\~12.7%), \`T\` (\~9.1%), and \`A\` (\~8.2%) are most common. By calculating character counts in large ciphertexts, attackers can rebuild the lookup mapping table instantly.

# 2. Polyalphabetic (Vigenère) &amp; Grid Substitution

The <strong>Vigenère Cipher</strong> mitigates frequency analysis by using a keyword to shift letters. Each letter in the key determines the Caesar shift for the corresponding message letter. The key repeats to match the length of the plaintext.

`Vigenère Formula: C_i = (P_i + K_(i mod len(K))) mod 26`

> [!NOTE]
>
> <strong>Example Trace:</strong><br> Plaintext: `ATTACK` | Key: `KEY`<br> Repeated Key: `KEYKEY`<br> • <strong>A (0) + K (10)</strong> mod 26 = 10 -&gt; <strong>K</strong><br> • <strong>T (19) + E (4)</strong> mod 26 = 23 -&gt; <strong>X</strong><br> • <strong>T (19) + Y (24)</strong> mod 26 = 43 mod 26 = 17 -&gt; <strong>R</strong><br> • <strong>A (0) + K (10)</strong> mod 26 = 10 -&gt; <strong>K</strong><br> • <strong>C (2) + E (4)</strong> mod 26 = 6 -&gt; <strong>G</strong><br> • <strong>K (10) + Y (24)</strong> mod 26 = 34 mod 26 = 8 -&gt; <strong>I</strong><br> <strong>Ciphertext:</strong> `KXRKGI`

# 3. Block and Transposition Ciphers (Playfair, Rail Fence, Hill)

> [!INFO]
>
> <strong>Playfair Cipher:</strong> Encrypts pairs of letters (digrams) using a 5x5 key matrix.
>
> - If the two letters are in the same row, replace with the letter immediately to their right (wrapping around).
> - If in the same column, replace with the letter immediately below (wrapping around).
> - Otherwise, form a rectangle and pick the letters at the opposite corners in the same row.

> [!INFO]
>
> <strong>Rail Fence (Transposition) Cipher:</strong> Scrambles the position of letters (transposition) by writing the message diagonally in a zig-zag across imaginary rails:
>
> `Plaintext: "SECRET MESSAGE", Rails: 3`<br>`S . . . E . . . E . . . G .`<br>`. E . R . T . M . S . A . E`<br>`. . C . . . S . . . S . . .`<br>`Ciphertext read row-by-row: "SEEGERTMAECCS"`

> [!INFO]
>
> <strong>Hill Cipher:</strong> Combines letters into vectors and encrypts them using matrix multiplication.
>
> `Vector C = (Matrix K * Vector P) mod 26`
>
> For example, to encrypt \`HE\` (7, 4) with Key Matrix `[[3, 3], [2, 5]]`:
>
> `C_1 = (3*7 + 3*4) mod 26 = 33 mod 26 = 7 (H)`<br>` C_2 = (2*7 + 5*4) mod 26 = 34 mod 26 = 8 (I) => Ciphertext: "HI"`
>
> To decrypt, the matrix must be invertible modulo 26 (i.e. determinant must share no common factors with 26).
