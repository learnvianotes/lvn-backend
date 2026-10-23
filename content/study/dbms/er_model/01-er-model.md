---
id: 50bdf5c8-e549-7850-93e4-f0ffcad1208a
key: topic:dbms/er_model
subject: dbms
topic: er_model
title: ER Model
slug: er-model
order: 1
---

The Entity-Relationship (ER) model is a conceptual, abstract database design framework representing entities, attributes, and relationships. It is mapped to a relational schema during the implementation phase.

# Entities &amp; Entity Sets

> [!NOTE] Strong Entity Set
>
> Can exist independently of other entities. Must have a primary key (composed of key attributes) to uniquely identify each instance.
>
> Symbol: Single Rectangle · Example: Customer (CustID)

> [!NOTE] Weak Entity Set
>
> Cannot exist without a corresponding strong entity set (its owner entity). Does not have a primary key. It is identified using the owner's primary key combined with its own <strong>partial key / discriminator</strong> attribute.
>
> Symbol: Double Rectangle · Example: Payment (PaymentNo, discriminator)

# Attributes in Detail

| Attribute Type | Visual Symbol | Rule &amp; Mechanics | Example Description |
| --- | --- | --- | --- |
| <strong>Key Attribute</strong> | Ellipse with underlined text | Uniquely identifies each instance in the entity set. | <u>`RollNo`</u> in Student relation |
| <strong>Composite Attribute</strong> | Ellipses branching out from another ellipse | Attribute composed of multiple sub-attributes. Saves structured details. | `Address` branching into `Street`, `City`, `Zip` |
| <strong>Multivalued Attribute</strong> | Double Ellipse | Can store more than one value for a single entity instance. | `Phone_No` (a student can have multiple phone numbers) |
| <strong>Derived Attribute</strong> | Dashed Ellipse | Value is computed dynamically from other stored columns. Not saved directly on disk. | `Age` (computed dynamically from `Date_Of_Birth`) |

# Relationships &amp; Degree

A relationship connects two or more entities. The <strong>degree</strong> is the number of participating entity sets:

> [!NOTE] Unary (Recursive)
>
> A single entity set relates to itself.
>
> `Person — [Marries] — Person`

> [!NOTE] Binary
>
> Two entity sets participate.
>
> `Student — [Enrolled] — Course`

> [!NOTE] Ternary
>
> Three entity sets participate.
>
> `Doctor — [Treats] — Patient`<br>`            |        `<br>`      [Medicine]`

# Cardinality &amp; Structural Constraints

> [!INFO]
>
> <strong>Participation Constraints (min cardinality):</strong> <br>• <strong>Total Participation (Double Line):</strong> Every entity in the set must participate in at least one relationship instance. (e.g., every `Employee` must belong to a `Department`). <br>• <strong>Partial Participation (Single Line):</strong> Entities can exist without participating in the relationship. (e.g., not every `Employee` manages a `Department`). <br><br> <strong>Min-Max Notation </strong><strong>`(min, max)`</strong><strong>:</strong> <br>• Placed on the line connecting the entity set and relationship. <br>• `min = 0` indicates partial participation. `min ≥ 1` indicates total participation. <br>• `max` represents the cardinality ratio limit (e.g., 1 or N).

# Generalization, Specialization, Aggregation &amp; Inheritance

> [!NOTE] Generalization & Specialization
>
> <strong>Generalization:</strong> Bottom-up approach where common attributes of lower-level entities are combined into a high-level parent entity. <br><strong>Specialization:</strong> Top-down approach where a parent entity is decomposed into lower-level sub-entities based on specialized attributes.

> [!NOTE] Aggregation
>
> Abstraction where a relationship set (and participating entities) is enclosed in a box and treated as a single higher-level entity, allowing it to have relationship links to other entities.

> [!NOTE] Types of Inheritance
>
> - <strong>Attribute Inheritance:</strong> Lower-level entities inherit all attributes of the parent entity automatically.
> - <strong>Relationship Inheritance:</strong> Lower-level entities participate in all relationships that the parent entity participates in.
> - <strong>Overriding Inheritance:</strong> A sub-entity can redefine a parent attribute or relationship for its specific type.

# ER-to-Relational Mapping Algorithm

Step-by-step logic to map conceptual ER diagrams into database tables:

1. <strong>Strong Entity</strong>

   Create a table. Simple attributes become columns. Composite attributes are flattened into individual columns (e.g. `Street`, `City` columns). Key attribute becomes the Primary Key.

2. <strong>Weak Entity</strong>

   Create a table. Add all attributes of the weak entity. Put the Primary Key of the owner entity as a Foreign Key. The Primary Key is a composite key: `{Owner_PK, Discriminator}`.

3. <strong>1:1 Relationships</strong>

   Based on participation constraints: <br>• <strong>Both Total:</strong> Merge the two entity sets into a single table. <br>• <strong>One Total, One Partial:</strong> Take the PK from the partial side and place it as a Foreign Key in the total participation side's table. <br>• <strong>Both Partial:</strong> Keep separate tables and add a Foreign Key to either side (preferably the side with fewer null rows).

4. <strong>1:N / N:1 Relationships</strong>

   Do not create a new table. Take the Primary Key from the "1" side and place it as a Foreign Key in the table representing the "N" side (to avoid null values).

5. <strong>M:N Relationships</strong>

   <strong>Must create a new table</strong>. The columns of the new table are the primary keys of both participating entities (each acting as a foreign key). The primary key of this new table is the composite key `{PK1, PK2}`.

6. <strong>Multivalued Attribute</strong>

   <strong>Create a new table</strong>. Place the parent entity's Primary Key (as FK) and the multivalued attribute column in this table. The composite PK is `{Parent_PK, Attribute}`.
