<div style="display: flex; justify-content: center; margin: 20px 0; color: #ffffff;">
  <img src="public/docs/logo.svg" style="max-width: 400px; height: auto; color: #ffffff;" />
</div>
<div style="text-align: center; margin-bottom: 20px; color: #ffffff;">
  <h1 style="font-size: 2.5em; margin: 0;">Mano Forge</h1>
  <p style="font-size: 1.2em; margin: 5px 0;">A simulator based on Morris Mano's basic architecture of a computer!</p>
</div>

## The plan, now complete :)

<div style="display: flex; justify-content: center; margin: 20px 0;">
  <img src="public/docs/plan.svg" style="max-width: 100%; height: auto;" />
</div>

## The grammar of the assembly language is as follows:

```
program      → line* EOF
line         → statement NEWLINE
statement    → instruction | labelDecl
instruction  → OPCODE operand?
labelDecl    → IDENTIFIER COMMA (instruction | dataDecl)
dataDecl     → DATATYPE NUMBER
operand      → IDENTIFIER | NUMBER
```
