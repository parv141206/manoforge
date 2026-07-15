# Intel 8085 Architecture, Assembly Language, Syntax, and Machine-Code Reference

**Goal:** one structured, exam/dev-friendly reference for the Intel 8085: tech specs, architecture, buses, memory model, assembly grammar, allowed mnemonics/directives, opcode/machine-code mapping, timing, interrupts, and practical examples.

**Scope note:** This document describes the **official Intel 8085/8085A programming model**. A short warning section at the end mentions 8085 undocumented opcodes, but they are **not part of the official assembler language** and should not be used in normal coursework or reliable programs.

**Primary references checked while preparing this file:**

1. Intel Corporation, *8080/8085 Assembly Language Programming Manual*, Order No. 9800301-04, May 1981.  
   Source: https://bitsavers.trailing-edge.com/components/intel/MCS80/9800301D_8080_8085_Assembly_Language_Programming_Manual_May81.pdf
2. Intel Corporation, *8085A / 8085A-2 Single Chip 8-Bit N-Channel Microprocessors Datasheet*.  
   Source: https://www.inf.pucrs.br/calazans/undergrad/orgcomp_EC/mat_microproc/intel-8085_datasheet.pdf
3. Intel Corporation, *MCS-80/85 Family User's Manual*, Jan 1983.  
   Source: https://archive.org/details/Mcs80_85FamilyUsersManual

---

## 1. 8085 in one page

### 1.1 Core identity

| Item | 8085 detail |
|---|---|
| Manufacturer/origin | Intel MCS-85 family |
| CPU width | 8-bit CPU / 8-bit ALU |
| External data bus | 8-bit, multiplexed on `AD0-AD7` during part of the bus cycle |
| External address bus | 16-bit address space: `A15-A8` + multiplexed `AD7-AD0` |
| Maximum directly addressable memory | `2^16 = 65,536 bytes = 64 KiB`, byte-addressed |
| I/O addressing | Separate 8-bit I/O port address space for `IN`/`OUT`: up to 256 ports; memory-mapped I/O also possible by external decoding |
| Power supply | Single `+5 V` supply for 8085A family |
| Package | 40-pin DIP in the classic part |
| Clocking | On-chip clock generator; `X1/X2` input frequency is divided by 2 internally |
| Typical 8085A internal clock cycle | Datasheet timing uses `tCY = 320 ns` for 8085A and `200 ns` for 8085A-2, corresponding to about 3.125 MHz and 5 MHz internal CPU clock respectively |
| Minimum instruction time | 4 T-states: about 1.28 µs on 8085A at 320 ns/T, about 0.8 µs on 8085A-2 at 200 ns/T |
| Official unique 8085 instructions over 8080 | `RIM` and `SIM` |
| Official documented opcode count | 246 documented byte opcodes; 10 byte values are reserved/undocumented in official Intel 8085 assembly docs |
| Interrupt inputs | `TRAP`, `RST 7.5`, `RST 6.5`, `RST 5.5`, `INTR` |
| Serial lines | `SID` serial input, `SOD` serial output, controlled/read by `RIM`/`SIM` |

### 1.2 What 8085 is **not**

The 8085 has no built-in cache, MMU, protected mode, virtual memory, floating point unit, multiply instruction, divide instruction, or modern pipeline. It is a small 8-bit accumulator-centered processor.

---

## 2. System architecture overview

### 2.1 Big-picture 8085 system

```text
                 +-----------------------------------+
                 |             8085 CPU              |
                 |                                   |
                 |  ALU + Accumulator + Flags        |
                 |  Registers B C D E H L            |
                 |  PC, SP, Instruction Register     |
                 |  Timing & Control Unit            |
                 +-----------------+-----------------+
                                   |
             +---------------------+----------------------+
             |                                            |
      A15-A8 | high address bus                   AD7-AD0 | multiplexed
             |                                            | address/data
             v                                            v
       +-----------+                              +----------------+
       | Address   |<------ ALE ------------------| Address latch  |
       | decode    |                              | e.g. 74LS373    |
       +-----------+                              +----------------+
             |                                            |
             +--------------------+-----------------------+
                                  |
                         +--------+--------+
                         |  Memory / I/O   |
                         |  ROM, RAM, PPI  |
                         +-----------------+

Control/status lines: RD#, WR#, IO/M, S1, S0, ALE, READY, HOLD, HLDA, INTA#, RESET.
```

The low address byte and data share pins `AD0-AD7`. During **T1**, `AD0-AD7` carry address bits `A0-A7`; after ALE latches that address externally, the same pins carry data during later T-states.

### 2.2 Internal programming model

```text
                  8-bit internal data bus
        +------------------------------------------+
        |                                          |
   +----v----+       +------------------+          |
   |   A     |<----->|       ALU        |<---------+
   | Accum.  |       +------------------+
   +----+----+                |
        |                     v
   +----v----+       +------------------+
   | Flags   |       | Instruction      |
   | S Z AC  |       | register/decoder |
   | P CY    |       +------------------+
   +---------+

   General registers, pairable as 16-bit:

   +-----+-----+     +-----+-----+     +-----+-----+
   |  B  |  C  |     |  D  |  E  |     |  H  |  L  |
   +-----+-----+     +-----+-----+     +-----+-----+
      BC pair           DE pair           HL pair
                                            |
                                            +--> M means memory byte at address HL

   16-bit special registers:

   +-------------------+      +-------------------+
   | PC Program Counter|      | SP Stack Pointer  |
   +-------------------+      +-------------------+
```

### 2.3 CPU blocks explained

| Block | Purpose |
|---|---|
| Accumulator `A` | Main 8-bit register used by most arithmetic/logical operations. |
| ALU | Performs 8-bit arithmetic/logical operations. |
| Flag register | Stores result conditions: sign, zero, auxiliary carry, parity, carry. |
| General registers | `B,C,D,E,H,L`; can be used individually or as pairs `BC`, `DE`, `HL`. |
| `HL` as memory pointer | Operand `M` means `memory[HL]`; not a separate register. |
| Program Counter `PC` | 16-bit address of the next instruction byte. |
| Stack Pointer `SP` | 16-bit pointer to the top of stack in RAM. |
| Instruction register/decoder | Holds and decodes current opcode byte. |
| Timing/control unit | Generates machine cycles, control signals, interrupt acknowledge, READY wait states, HOLD/HLDA bus release. |
| Temporary registers | Internal registers such as W/Z are used by the CPU but are not programmer-visible. |

---

## 3. Programmer-visible registers

### 3.1 8-bit registers

| Register | Width | Typical role |
|---|---:|---|
| `A` | 8 | Accumulator. Most ALU results go here. |
| `B` | 8 | General-purpose register; high byte of `BC`. |
| `C` | 8 | General-purpose register; low byte of `BC`. |
| `D` | 8 | General-purpose register; high byte of `DE`. |
| `E` | 8 | General-purpose register; low byte of `DE`. |
| `H` | 8 | General-purpose register; high byte of `HL`. |
| `L` | 8 | General-purpose register; low byte of `HL`. |
| `F` / flags | 8 physical bits | Not usually addressed as `F`; accessed with `PUSH PSW` / `POP PSW`. |

### 3.2 16-bit register pairs

| Pair | High byte | Low byte | Use |
|---|---|---|---|
| `BC` | `B` | `C` | Register pair for `LXI`, `INX`, `DCX`, `DAD`, `LDAX`, `STAX`. |
| `DE` | `D` | `E` | Register pair; also indirect pair for `LDAX`/`STAX`. |
| `HL` | `H` | `L` | Main memory pointer. `M` means byte at address `HL`. |
| `SP` | high byte internal | low byte internal | Stack pointer. |
| `PSW` | `A` | flags | Program Status Word, used only with `PUSH PSW` / `POP PSW`. |

### 3.3 Flag register

Official user-visible flags:

| Flag | Name | Meaning after arithmetic/logical operations |
|---|---|---|
| `S` | Sign | Set if result bit 7 is `1`; useful for signed two's-complement sign tests. |
| `Z` | Zero | Set if result is `00H`. |
| `AC` | Auxiliary Carry | Carry/borrow between bit 3 and bit 4; mainly for BCD/`DAA`. |
| `P` | Parity | Set for even parity in the 8-bit result. |
| `CY` | Carry | Carry out in addition; borrow in subtraction; also used by rotate-through-carry instructions. |

Common educational bit layout:

```text
bit:    7   6   5   4   3   2   1   0
      +---+---+---+---+---+---+---+---+
      | S | Z | x | AC| x | P | x | CY|
      +---+---+---+---+---+---+---+---+
```

Intel's 8080 documentation showed filler bits 5 and 3 as zero and bit 1 as one. Intel's 8080/8085 assembly manual warns that these filler bits are **undefined on the 8085** when formatted by `PUSH PSW`. So: **do not rely on bits 5, 3, or 1 in portable 8085 code**.

---

## 4. Memory model

### 4.1 Address space

The 8085 has a 16-bit address bus, so it can address:

```text
0000H  -------------------------------------------------
       |                                               |
       |  64 KiB byte-addressed memory                 |
       |  ROM / RAM / memory-mapped I/O as decoded     |
       |  by external hardware                         |
       |                                               |
FFFFH  -------------------------------------------------
```

Total memory address range:

```text
0000H to FFFFH
= 65,536 unique byte addresses
= 64 KiB
```

Memory is **byte-addressed**. A 16-bit value is stored in two consecutive bytes.

### 4.2 Little-endian order

For 16-bit immediates and addresses, machine code stores the **low byte first**, then the high byte.

Example:

```asm
LXI H,2050H
```

Machine bytes:

```text
21 50 20
|  |  |
|  |  +-- high byte of 2050H
|  +----- low byte of 2050H
+-------- opcode for LXI H,d16
```

Direct memory instruction example:

```asm
STA 3050H
```

Machine bytes:

```text
32 50 30
```

### 4.3 Stack memory

The stack is placed in RAM and grows **downward**.

```text
Higher addresses
     |
     |     older stack data
     |
SP ->|     top of stack
     |
     v
Lower addresses
```

For `PUSH B`, with `BC = 2A4CH` and `SP = 9AAFH` before push:

```text
Before PUSH B:                 After PUSH B:

Address   Data                 Address   Data
9AAF      xx      SP before     9AAF      xx
9AAE      xx                    9AAE      2A   <- B stored first
9AAD      xx                    9AAD      4C   <- C stored second, SP after
9AAC      xx                    9AAC      xx
```

So, after a push, `SP` points at the low-order byte of the pushed pair. `POP` reverses this.

---

## 5. I/O model

The 8085 supports two I/O styles:

### 5.1 Port-mapped I/O

`IN port8` and `OUT port8` use a separate 8-bit I/O address.

```asm
IN  20H     ; A <- input from port 20H
OUT 21H     ; output A to port 21H
```

Port range:

```text
00H to FFH = 256 possible port addresses
```

### 5.2 Memory-mapped I/O

External hardware can decode normal memory addresses and connect devices as if they were memory locations. Then regular memory instructions such as `LDA`, `STA`, `MOV M,A`, etc. can access the device.

| Feature | Port-mapped I/O | Memory-mapped I/O |
|---|---|---|
| Address space | Separate 256 I/O ports | Uses 64 KiB memory address space |
| Instructions | `IN`, `OUT` only | Many memory instructions possible |
| Control signal | `IO/M = 1` | `IO/M = 0` |
| Address width | 8-bit port operand | 16-bit memory address |

---

## 6. Pinout and external signals

### 6.1 40-pin DIP pinout

```text
                  Intel 8085A / 8085A-2
              +-----------------------------+
        X1  1 |                             | 40 VCC (+5V)
        X2  2 |                             | 39 HOLD
 RESET OUT 3 |                             | 38 HLDA
       SOD 4 |                             | 37 CLK OUT
       SID 5 |                             | 36 RESET IN
      TRAP 6 |                             | 35 READY
    RST7.5 7 |                             | 34 IO/M
    RST6.5 8 |                             | 33 S1
    RST5.5 9 |                             | 32 RD#
      INTR10 |                             | 31 WR#
     INTA#11 |                             | 30 ALE
       AD0 12|                             | 29 S0
       AD1 13|                             | 28 A15
       AD2 14|                             | 27 A14
       AD3 15|                             | 26 A13
       AD4 16|                             | 25 A12
       AD5 17|                             | 24 A11
       AD6 18|                             | 23 A10
       AD7 19|                             | 22 A9
       VSS 20|                             | 21 A8
              +-----------------------------+
```

`#` means active-low signal.

### 6.2 Address/data pins

| Pins | Direction | Meaning |
|---|---|---|
| `A8-A15` | Output | High-order 8 address bits. Also part of I/O address/status use depending on cycle. |
| `AD0-AD7` | I/O | Multiplexed lower address byte during T1, then data bus during later T-states. |
| `ALE` | Output | Address Latch Enable. Used to latch `AD0-AD7` as `A0-A7`. |

### 6.3 Control/status pins

| Signal | Meaning |
|---|---|
| `RD#` | Read control; low means selected memory/I/O should drive data bus. |
| `WR#` | Write control; low means selected memory/I/O should accept data bus. |
| `IO/M` | Distinguishes I/O cycle from memory cycle. In common notation: `1 = I/O`, `0 = memory`. |
| `S1`, `S0` | Status lines indicating machine-cycle type with `IO/M`. |
| `READY` | If low, inserts wait states for slow memory/I/O. |
| `HOLD` | External bus master requests address/data/control bus. |
| `HLDA` | Hold acknowledge; CPU has released buses. |
| `RESET IN` | Resets CPU, clears PC to `0000H`, disables interrupts. |
| `RESET OUT` | Reset indication usable by rest of system. |
| `CLK OUT` | Clock output for system use. |

### 6.4 Interrupt and serial pins

| Signal | Meaning |
|---|---|
| `TRAP` | Highest-priority non-maskable vectored interrupt. |
| `RST 7.5` | Maskable vectored interrupt, edge-triggered/latching. |
| `RST 6.5` | Maskable vectored interrupt, level-sensitive. |
| `RST 5.5` | Maskable vectored interrupt, level-sensitive. |
| `INTR` | General-purpose maskable interrupt, non-vectored. External device supplies instruction during `INTA#`. |
| `INTA#` | Interrupt acknowledge for `INTR`. |
| `SID` | Serial input data. Read into accumulator bit 7 by `RIM`. |
| `SOD` | Serial output data. Controlled by `SIM`. |

---

## 7. Machine cycles, T-states, and bus timing

### 7.1 Vocabulary

| Term | Meaning |
|---|---|
| T-state | One internal clock period of the CPU. |
| Machine cycle | One bus-level operation: opcode fetch, memory read, memory write, I/O read, I/O write, interrupt acknowledge, etc. |
| Instruction cycle | Full execution of one instruction; contains one or more machine cycles. |

### 7.2 Basic memory read cycle idea

```text
T1                         T2                         T3
+--------------------------+--------------------------+------------------
A15-A8: high address       stable/address/status       stable
AD7-AD0: low address       data bus                    data bus
ALE:    ___/^^^^\___       low                         low
RD#:    high               ___/low\___                 high
WR#:    high               high                        high
```

During T1, the lower address appears on `AD0-AD7` and is latched externally using `ALE`. During T2/T3, the same pins become data bus pins.

### 7.3 Machine-cycle status table

Intel's datasheet status encoding:

| `IO/M` | `S1` | `S0` | Machine-cycle status |
|---:|---:|---:|---|
| 0 | 0 | 1 | Memory write |
| 0 | 1 | 0 | Memory read |
| 1 | 0 | 1 | I/O write |
| 1 | 1 | 0 | I/O read |
| 0 | 1 | 1 | Opcode fetch |
| 1 | 1 | 1 | Interrupt acknowledge |
| * | 0 | 0 | Halt |
| * | X | X | Hold |
| * | X | X | Reset |

`*` indicates high impedance/3-state behavior for relevant buses/signals in those modes; `X` means unspecified.

### 7.4 READY and wait states

If `READY = 0`, the CPU waits an integral number of clock cycles before completing the current read/write machine cycle. This is how slow memory or peripherals can work with the CPU.

```text
Normal:     T1  T2  T3
With wait:  T1  T2  Tw  Tw  T3
```

### 7.5 HOLD / HLDA DMA-style bus release

```text
External master:  HOLD = 1  -------------------->
8085:                     finishes current bus cycle
8085:             HLDA = 1 ---------------------> buses released
External master:  uses buses
External master:  HOLD = 0
8085:             HLDA = 0, CPU resumes buses
```

---

## 8. Interrupt architecture

### 8.1 Interrupt priority and vector addresses

| Interrupt | Priority | Vector / branch address | Trigger type | Maskable? |
|---|---:|---:|---|---|
| `TRAP` | 1 highest | `0024H` | Rising edge and high level until sampled | No, non-maskable |
| `RST 7.5` | 2 | `003CH` | Rising edge, latched | Yes |
| `RST 6.5` | 3 | `0034H` | High level until sampled | Yes |
| `RST 5.5` | 4 | `002CH` | High level until sampled | Yes |
| `INTR` | 5 lowest | Depends on instruction supplied during `INTA#` | High level until sampled | Yes |

When a vectored interrupt is accepted, the processor pushes the current `PC` on the stack and loads the interrupt vector address into `PC`.

### 8.2 Reset and restart vectors

| Event/instruction | Address |
|---|---:|
| Hardware reset | `0000H` |
| `RST 0` | `0000H` |
| `RST 1` | `0008H` |
| `RST 2` | `0010H` |
| `RST 3` | `0018H` |
| `TRAP` | `0024H` |
| `RST 5.5` | `002CH` |
| `RST 6.5` | `0034H` |
| `RST 7` | `0038H` |
| `RST 7.5` | `003CH` |

Note: `RST 4` is `0020H`, `RST 5` is `0028H`, `RST 6` is `0030H`.

### 8.3 `EI` and `DI`

```asm
EI      ; enable maskable interrupts
DI      ; disable maskable interrupts
```

`TRAP` is non-maskable by software masking. The other hardware interrupts are affected by the interrupt enable/mask logic.

### 8.4 `SIM` bit layout

`SIM` uses the current accumulator bits:

```text
A bit:   7    6    5    4      3      2      1      0
       +----+----+----+------+-----+------+------+------+
       |SOD |SDE | x  |R7.5 | MSE | M7.5 | M6.5 | M5.5 |
       +----+----+----+------+-----+------+------+------+
```

| Bit | Meaning |
|---:|---|
| 7 | Serial output data value to place on `SOD`. |
| 6 | Serial data enable. If `1`, bit 7 is output on `SOD`. |
| 5 | Unused/reserved in official programming. |
| 4 | Reset `RST 7.5` latch when `1`. |
| 3 | Mask Set Enable. If `1`, bits 2-0 update interrupt masks. |
| 2 | Mask for `RST 7.5`; `1` masks/disables it. |
| 1 | Mask for `RST 6.5`; `1` masks/disables it. |
| 0 | Mask for `RST 5.5`; `1` masks/disables it. |

### 8.5 `RIM` bit layout

After `RIM`, accumulator bits contain:

```text
A bit:   7      6       5       4      3      2      1      0
       +-----+-------+-------+-------+----+------+------+------+
       | SID | I7.5 | I6.5 | I5.5 | IE | M7.5 | M6.5 | M5.5 |
       +-----+-------+-------+-------+----+------+------+------+
```

| Bit | Meaning |
|---:|---|
| 7 | Current serial input data from `SID`. |
| 6 | Pending interrupt bit for `RST 7.5`. |
| 5 | Pending interrupt bit for `RST 6.5`. |
| 4 | Pending interrupt bit for `RST 5.5`. |
| 3 | Interrupt Enable flip-flop status. |
| 2 | Mask status for `RST 7.5`. |
| 1 | Mask status for `RST 6.5`. |
| 0 | Mask status for `RST 5.5`. |

---

## 9. Addressing modes

| Mode | Form | Example | Meaning |
|---|---|---|---|
| Implied / implicit | No explicit operand | `CMA`, `STC`, `HLT` | Operand is implied by instruction. |
| Register | Register operand | `MOV A,B`, `ADD C` | Data is inside CPU register. |
| Immediate 8-bit | `d8` follows opcode | `MVI A,3EH`, `ADI 05H` | Operand byte is part of instruction. |
| Immediate 16-bit | `d16` follows opcode | `LXI H,2050H` | Low byte then high byte follow opcode. |
| Direct memory | 16-bit address follows opcode | `LDA 2050H`, `STA 3050H` | Instruction contains memory address. |
| Register indirect | `M` via `HL`, or `LDAX/STAX` via `BC/DE` | `MOV A,M`, `LDAX D` | Register pair contains memory address. |
| I/O direct | 8-bit port follows opcode | `IN 20H`, `OUT 21H` | Instruction contains port address. |

`M` is important: it is **not** an actual register. It means:

```text
M = memory byte at address stored in HL
```

Example:

```asm
LXI H,2050H   ; HL = 2050H
MOV A,M       ; A = memory[2050H]
```

---

## 10. Official assembly language grammar

### 10.1 Source line format

Intel's assembler source line has up to four fields:

```text
[label:]   opcode   operand(s)   ;comment
```

More formally:

```ebnf
source-line     ::= [label-field] [opcode-field [operand-field]] [comment-field]
label-field     ::= symbol ':'
opcode-field    ::= instruction-mnemonic | assembler-directive
operand-field   ::= operand { ',' operand }
comment-field   ::= ';' any-text
```

Examples:

```asm
START:  MVI A,32H       ; load accumulator with 32H
        OUT 01H         ; send A to port 01H
LOOP:   JMP LOOP        ; infinite loop
```

### 10.2 Label/name rules in Intel assembler

| Rule | Detail |
|---|---|
| Labels optional? | Yes. |
| Label terminator | `:` colon. |
| Length | 1 to 6 alphanumeric characters in Intel assembler. |
| First character | Alphabetic, `?`, or `@`. |
| Redefinition | A normal label can be defined only once. |
| Case | Intel assembler accepts upper/lowercase but treats letters internally as uppercase. |
| Directive names | `EQU`, `SET`, `MACRO` use a name field without colon. |

### 10.3 Legal characters and delimiters

Common legal source characters include letters, digits, and special characters such as:

```text
+  -  *  /  ,  (  )  '  &  :  $  @  ?  =  <  >  %  !  space  ;  .
```

Important delimiters:

| Delimiter | Use |
|---|---|
| space/tab | Field separator or symbol terminator. |
| comma | Separates operands. |
| single quotes | ASCII/string constants. |
| parentheses | Expression grouping. |
| semicolon | Starts comment. |
| colon | Ends label. |
| carriage return | Ends statement. |

### 10.4 Numeric constants

| Type | Syntax | Example |
|---|---|---|
| Hexadecimal | Must begin with digit and end in `H` | `0BAH`, `2050H`, `0FFH` |
| Decimal | Digits, optional `D` suffix | `25`, `25D` |
| Octal | Ends in `O` or `Q` | `72Q`, `72O` |
| Binary | Ends in `B` | `11110110B` |
| ASCII | Single quotes | `'A'`, `'TIME'` |
| Current location | `$` | `JMP $+6` |

Important hex rule: if the first hex digit would be `A-F`, prefix a zero.

```asm
MVI A,0BAH     ; correct
MVI A,BAH      ; not valid in Intel assembler style, because it begins with B
```

### 10.5 Operand symbols

| Symbol | Meaning |
|---|---|
| `A` | Accumulator. |
| `B,C,D,E,H,L` | Registers. |
| `M` | Memory byte pointed to by `HL`. |
| `SP` | Stack pointer. |
| `PSW` | Program Status Word = `A` plus flags. |
| `d8` | 8-bit immediate data. Not literal syntax; documentation placeholder. |
| `d16` | 16-bit immediate data. |
| `a16` | 16-bit memory address. |
| `port8` | 8-bit I/O port address. |

---

## 11. Official allowed instruction mnemonics

### 11.1 Data transfer group

```text
MOV   MVI   LXI   LDA   STA   LHLD   SHLD   LDAX   STAX   XCHG
```

### 11.2 Arithmetic group

```text
ADD   ADC   ADI   ACI   SUB   SBB   SUI   SBI
INR   DCR   INX   DCX   DAD   DAA
```

### 11.3 Logical group

```text
ANA   ANI   XRA   XRI   ORA   ORI   CMP   CPI
RLC   RRC   RAL   RAR   CMA   CMC   STC
```

### 11.4 Branch group

Unconditional:

```text
JMP   CALL   RET   RST   PCHL
```

Conditional jumps:

```text
JNZ   JZ   JNC   JC   JPO   JPE   JP   JM
```

Conditional calls:

```text
CNZ   CZ   CNC   CC   CPO   CPE   CP   CM
```

Conditional returns:

```text
RNZ   RZ   RNC   RC   RPO   RPE   RP   RM
```

### 11.5 Stack, I/O, and machine control group

```text
PUSH   POP   XTHL   SPHL
IN     OUT
EI     DI    SIM    RIM
NOP    HLT
```

### 11.6 Condition-code meanings

| Code | Meaning | Flag test |
|---|---|---|
| `NZ` | Not zero | `Z = 0` |
| `Z` | Zero | `Z = 1` |
| `NC` | No carry | `CY = 0` |
| `C` | Carry | `CY = 1` |
| `PO` | Parity odd | `P = 0` |
| `PE` | Parity even | `P = 1` |
| `P` | Plus | `S = 0` |
| `M` | Minus | `S = 1` |

---

## 12. Assembler directives and operators

These are **not CPU instructions**. They tell the assembler how to place bytes, define symbols, reserve storage, or conditionally assemble code.

### 12.1 Common Intel 8080/8085 assembler directives

| Directive | Purpose | Example |
|---|---|---|
| `EQU` | Define non-redefinable symbol value. | `PORT1 EQU 20H` |
| `SET` | Define/redefine symbol value. | `COUNT SET 10` |
| `DB` | Define byte(s) / string bytes. | `MSG DB 'HI',0DH,0AH` |
| `DW` | Define word(s), low byte first. | `PTR DW 2050H` |
| `DS` | Reserve storage bytes. | `BUF DS 64` |
| `IF` | Conditional assembly begin. | `IF DEBUG EQ 1` |
| `ELSE` | Conditional assembly else. | `ELSE` |
| `ENDIF` | End conditional assembly. | `ENDIF` |
| `END` | End source file; optional start expression. | `END START` |
| `ORG` | Set location counter. | `ORG 2000H` |
| `ASEG` | Absolute segment mode. | `ASEG` |
| `CSEG` | Relocatable code segment. | `CSEG` |
| `DSEG` | Relocatable data segment. | `DSEG` |
| `PUBLIC` | Export symbols for linking. | `PUBLIC START` |
| `EXTRN` | Import external symbols. | `EXTRN DELAY` |
| `NAME` | Name object module. | `NAME TEST` |
| `STKLN` | Specify stack size for module. | `STKLN 64` |
| `MACRO` | Begin macro definition. | `PUSHALL MACRO` |
| `LOCAL` | Declare macro-local symbols. | `LOCAL LOOP` |
| `ENDM` | End macro definition. | `ENDM` |

For typical college-level 8085 programming, you mostly use:

```text
ORG   DB   DW   DS   EQU   END
```

### 12.2 Expression operators

Common Intel assembler expression operators include:

```text
+   -   *   /   MOD
AND OR XOR NOT
EQ  NE  LT  LE  GT  GE
HIGH LOW
```

Examples:

```asm
PORT    EQU 20H
MASK    EQU 00001111B
LOWB    DB LOW 2050H
HIGHB   DB HIGH 2050H
NEXT:   JMP $+6
```

---

## 13. Instruction encoding rules

### 13.1 Register encoding

Many opcodes encode registers using a 3-bit field.

| Register code | Register |
|---:|---|
| `000` | `B` |
| `001` | `C` |
| `010` | `D` |
| `011` | `E` |
| `100` | `H` |
| `101` | `L` |
| `110` | `M` = memory at `HL` |
| `111` | `A` |

### 13.2 Register-pair encoding

For `LXI`, `INX`, `DCX`, `DAD`:

| Pair code | Pair |
|---:|---|
| `00` | `B` / `BC` |
| `01` | `D` / `DE` |
| `10` | `H` / `HL` |
| `11` | `SP` |

For `PUSH` and `POP`:

| Pair code | Pair |
|---:|---|
| `00` | `B` / `BC` |
| `01` | `D` / `DE` |
| `10` | `H` / `HL` |
| `11` | `PSW` |

### 13.3 Condition-code encoding

| Code bits | Condition |
|---:|---|
| `000` | `NZ` |
| `001` | `Z` |
| `010` | `NC` |
| `011` | `C` |
| `100` | `PO` |
| `101` | `PE` |
| `110` | `P` |
| `111` | `M` |

### 13.4 Opcode formulas

#### MOV

```text
MOV destination,source = 01 ddd sss
```

Example:

```asm
MOV A,C
```

```text
A = 111, C = 001
Opcode = 01 111 001 = 01111001B = 79H
```

Special case:

```text
01 110 110 = 76H = HLT, not MOV M,M
```

#### MVI

```text
MVI r,d8 = 00 rrr 110
```

Example:

```asm
MVI A,32H
```

```text
Opcode = 00 111 110 = 3EH
Machine code = 3E 32
```

#### INR / DCR

```text
INR r = 00 rrr 100
DCR r = 00 rrr 101
```

#### ALU register/memory group

```text
ALU r/M = 10 aaa rrr
```

| `aaa` | Operation |
|---:|---|
| `000` | `ADD` |
| `001` | `ADC` |
| `010` | `SUB` |
| `011` | `SBB` |
| `100` | `ANA` |
| `101` | `XRA` |
| `110` | `ORA` |
| `111` | `CMP` |

Example:

```asm
ADD M
```

```text
ADD = 000, M = 110
Opcode = 10 000 110 = 86H
```

#### LXI / INX / DCX / DAD

```text
LXI rp,d16 = 00 rp 0001
INX rp     = 00 rp 0011
DAD rp     = 00 rp 1001
DCX rp     = 00 rp 1011
```

#### Conditional branch encodings

```text
Jcc a16  = 11 ccc 010
Ccc a16  = 11 ccc 100
Rcc      = 11 ccc 000
```

Example:

```asm
JZ 2050H
```

```text
Jcc = 11 ccc 010
Z = 001
Opcode = 11001010B = CAH
Machine code = CA 50 20
```

#### RST

```text
RST n = 11 nnn 111 = C7H + 8*n
```

| Instruction | Opcode | Vector |
|---|---:|---:|
| `RST 0` | `C7H` | `0000H` |
| `RST 1` | `CFH` | `0008H` |
| `RST 2` | `D7H` | `0010H` |
| `RST 3` | `DFH` | `0018H` |
| `RST 4` | `E7H` | `0020H` |
| `RST 5` | `EFH` | `0028H` |
| `RST 6` | `F7H` | `0030H` |
| `RST 7` | `FFH` | `0038H` |

---

## 14. Full 8085 opcode / machine-code map

Legend:

| Placeholder | Meaning |
|---|---|
| `d8` | one immediate byte follows opcode |
| `d16` | two immediate bytes follow opcode, low byte first |
| `a16` | two address bytes follow opcode, low byte first |
| `--/UND` | reserved/undocumented in official Intel 8085 assembly documentation |

| High\Low | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `0x` | `NOP` | `LXI B,d16` | `STAX B` | `INX B` | `INR B` | `DCR B` | `MVI B,d8` | `RLC` | `--/UND` | `DAD B` | `LDAX B` | `DCX B` | `INR C` | `DCR C` | `MVI C,d8` | `RRC` |
| `1x` | `--/UND` | `LXI D,d16` | `STAX D` | `INX D` | `INR D` | `DCR D` | `MVI D,d8` | `RAL` | `--/UND` | `DAD D` | `LDAX D` | `DCX D` | `INR E` | `DCR E` | `MVI E,d8` | `RAR` |
| `2x` | `RIM` | `LXI H,d16` | `SHLD a16` | `INX H` | `INR H` | `DCR H` | `MVI H,d8` | `DAA` | `--/UND` | `DAD H` | `LHLD a16` | `DCX H` | `INR L` | `DCR L` | `MVI L,d8` | `CMA` |
| `3x` | `SIM` | `LXI SP,d16` | `STA a16` | `INX SP` | `INR M` | `DCR M` | `MVI M,d8` | `STC` | `--/UND` | `DAD SP` | `LDA a16` | `DCX SP` | `INR A` | `DCR A` | `MVI A,d8` | `CMC` |
| `4x` | `MOV B,B` | `MOV B,C` | `MOV B,D` | `MOV B,E` | `MOV B,H` | `MOV B,L` | `MOV B,M` | `MOV B,A` | `MOV C,B` | `MOV C,C` | `MOV C,D` | `MOV C,E` | `MOV C,H` | `MOV C,L` | `MOV C,M` | `MOV C,A` |
| `5x` | `MOV D,B` | `MOV D,C` | `MOV D,D` | `MOV D,E` | `MOV D,H` | `MOV D,L` | `MOV D,M` | `MOV D,A` | `MOV E,B` | `MOV E,C` | `MOV E,D` | `MOV E,E` | `MOV E,H` | `MOV E,L` | `MOV E,M` | `MOV E,A` |
| `6x` | `MOV H,B` | `MOV H,C` | `MOV H,D` | `MOV H,E` | `MOV H,H` | `MOV H,L` | `MOV H,M` | `MOV H,A` | `MOV L,B` | `MOV L,C` | `MOV L,D` | `MOV L,E` | `MOV L,H` | `MOV L,L` | `MOV L,M` | `MOV L,A` |
| `7x` | `MOV M,B` | `MOV M,C` | `MOV M,D` | `MOV M,E` | `MOV M,H` | `MOV M,L` | `HLT` | `MOV M,A` | `MOV A,B` | `MOV A,C` | `MOV A,D` | `MOV A,E` | `MOV A,H` | `MOV A,L` | `MOV A,M` | `MOV A,A` |
| `8x` | `ADD B` | `ADD C` | `ADD D` | `ADD E` | `ADD H` | `ADD L` | `ADD M` | `ADD A` | `ADC B` | `ADC C` | `ADC D` | `ADC E` | `ADC H` | `ADC L` | `ADC M` | `ADC A` |
| `9x` | `SUB B` | `SUB C` | `SUB D` | `SUB E` | `SUB H` | `SUB L` | `SUB M` | `SUB A` | `SBB B` | `SBB C` | `SBB D` | `SBB E` | `SBB H` | `SBB L` | `SBB M` | `SBB A` |
| `Ax` | `ANA B` | `ANA C` | `ANA D` | `ANA E` | `ANA H` | `ANA L` | `ANA M` | `ANA A` | `XRA B` | `XRA C` | `XRA D` | `XRA E` | `XRA H` | `XRA L` | `XRA M` | `XRA A` |
| `Bx` | `ORA B` | `ORA C` | `ORA D` | `ORA E` | `ORA H` | `ORA L` | `ORA M` | `ORA A` | `CMP B` | `CMP C` | `CMP D` | `CMP E` | `CMP H` | `CMP L` | `CMP M` | `CMP A` |
| `Cx` | `RNZ` | `POP B` | `JNZ a16` | `JMP a16` | `CNZ a16` | `PUSH B` | `ADI d8` | `RST 0` | `RZ` | `RET` | `JZ a16` | `--/UND` | `CZ a16` | `CALL a16` | `ACI d8` | `RST 1` |
| `Dx` | `RNC` | `POP D` | `JNC a16` | `OUT d8` | `CNC a16` | `PUSH D` | `SUI d8` | `RST 2` | `RC` | `--/UND` | `JC a16` | `IN d8` | `CC a16` | `--/UND` | `SBI d8` | `RST 3` |
| `Ex` | `RPO` | `POP H` | `JPO a16` | `XTHL` | `CPO a16` | `PUSH H` | `ANI d8` | `RST 4` | `RPE` | `PCHL` | `JPE a16` | `XCHG` | `CPE a16` | `--/UND` | `XRI d8` | `RST 5` |
| `Fx` | `RP` | `POP PSW` | `JP a16` | `DI` | `CP a16` | `PUSH PSW` | `ORI d8` | `RST 6` | `RM` | `SPHL` | `JM a16` | `EI` | `CM a16` | `--/UND` | `CPI d8` | `RST 7` |

---

## 15. Instruction summary with timing and flags

Timing is for standard 8085A behavior without inserted wait states. Conditional timings differ depending on whether the branch/call/return is taken.

| Instruction | Opcode(s) | Bytes | T-states | Machine cycles | Flags | Meaning |
|---|---:|---:|---:|---:|---|---|
| NOP | 00 | 1 | 4 | 1 | none | No operation. |
| MOV r1,r2 | 40-7F except 76 | 1 | 4 if register-register; 7 if either operand is M | 1 or 2 | none | Copy source to destination. `MOV M,M` is not valid; 76H is HLT. |
| MVI r,d8 | 06/0E/16/1E/26/2E/36/3E | 2 | 7; MVI M,d8 = 10 | 2 or 3 | none | Move immediate byte into register or memory. |
| LXI rp,d16 | 01/11/21/31 | 3 | 10 | 3 | none | Load register pair B/D/H/SP with immediate 16-bit data, low byte first. |
| LDA a16 | 3A | 3 | 13 | 4 | none | A <- memory[address]. |
| STA a16 | 32 | 3 | 13 | 4 | none | memory[address] <- A. |
| LHLD a16 | 2A | 3 | 16 | 5 | none | L <- M[addr], H <- M[addr+1]. |
| SHLD a16 | 22 | 3 | 16 | 5 | none | M[addr] <- L, M[addr+1] <- H. |
| LDAX B/D | 0A/1A | 1 | 7 | 2 | none | A <- M[BC] or M[DE]. |
| STAX B/D | 02/12 | 1 | 7 | 2 | none | M[BC] or M[DE] <- A. |
| XCHG | EB | 1 | 4 | 1 | none | Exchange DE and HL. |
| ADD r/M | 80-87 | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A + operand. |
| ADC r/M | 88-8F | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A + operand + CY. |
| ADI d8 | C6 | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A + immediate. |
| ACI d8 | CE | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A + immediate + CY. |
| SUB r/M | 90-97 | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A - operand; CY is borrow. |
| SBB r/M | 98-9F | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A - operand - CY. |
| SUI d8 | D6 | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A - immediate. |
| SBI d8 | DE | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A - immediate - CY. |
| INR r/M | 04/0C/14/1C/24/2C/34/3C | 1 | 4 for register; 10 for M | 1 or 3 | S,Z,AC,P (not CY) | Increment by 1. |
| DCR r/M | 05/0D/15/1D/25/2D/35/3D | 1 | 4 for register; 10 for M | 1 or 3 | S,Z,AC,P (not CY) | Decrement by 1. |
| INX rp | 03/13/23/33 | 1 | 6 | 1 | none | Increment register pair. |
| DCX rp | 0B/1B/2B/3B | 1 | 6 | 1 | none | Decrement register pair. |
| DAD rp | 09/19/29/39 | 1 | 10 | 3 | CY only | HL <- HL + rp. |
| DAA | 27 | 1 | 4 | 1 | S,Z,AC,P,CY | Decimal adjust accumulator after BCD addition. |
| ANA r/M | A0-A7 | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A AND operand; CY reset; AC set on 8085. |
| ANI d8 | E6 | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A AND immediate; CY reset; AC set on 8085. |
| XRA r/M | A8-AF | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A XOR operand; CY and AC reset. |
| XRI d8 | EE | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A XOR immediate; CY and AC reset. |
| ORA r/M | B0-B7 | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | A <- A OR operand; CY and AC reset. |
| ORI d8 | F6 | 2 | 7 | 2 | S,Z,AC,P,CY | A <- A OR immediate; CY and AC reset. |
| CMP r/M | B8-BF | 1 | 4 for register; 7 for M | 1 or 2 | S,Z,AC,P,CY | Compare A with operand using subtraction; A unchanged. |
| CPI d8 | FE | 2 | 7 | 2 | S,Z,AC,P,CY | Compare A with immediate; A unchanged. |
| RLC/RRC/RAL/RAR | 07/0F/17/1F | 1 | 4 | 1 | CY only | Rotate accumulator left/right; RAL/RAR include carry. |
| CMA | 2F | 1 | 4 | 1 | none | Complement accumulator. |
| CMC | 3F | 1 | 4 | 1 | CY only | Complement carry. |
| STC | 37 | 1 | 4 | 1 | CY only | Set carry. |
| JMP a16 | C3 | 3 | 10 | 3 | none | Unconditional jump. |
| Jcc a16 | C2/CA/D2/DA/E2/EA/F2/FA | 3 | 10 if taken; 7 if not taken | 3 or 2 | none | Conditional jump: NZ,Z,NC,C,PO,PE,P,M. |
| CALL a16 | CD | 3 | 18 | 5 | none | Push return address, jump to subroutine. |
| Ccc a16 | C4/CC/D4/DC/E4/EC/F4/FC | 3 | 18 if taken; 9 if not taken | 5 or 2 | none | Conditional call. |
| RET | C9 | 1 | 10 | 3 | none | Return from subroutine. |
| Rcc | C0/C8/D0/D8/E0/E8/F0/F8 | 1 | 12 if taken; 6 if not taken | 3 or 1 | none | Conditional return. |
| RST n | C7/CF/D7/DF/E7/EF/F7/FF | 1 | 12 | 3 | none | One-byte call to vector n*8. |
| PCHL | E9 | 1 | 5 | 1 | none | PC <- HL. |
| PUSH rp/PSW | C5/D5/E5/F5 | 1 | 12 | 3 | none | Push register pair/PSW onto descending stack. |
| POP rp/PSW | C1/D1/E1/F1 | 1 | 10 | 3 | POP PSW restores flags | Pop register pair/PSW from stack. |
| XTHL | E3 | 1 | 18 | 5 | none | Exchange HL with top word of stack. |
| SPHL | F9 | 1 | 6 | 1 | none | SP <- HL. |
| IN d8 | DB | 2 | 10 | 3 | none | A <- input port immediate. |
| OUT d8 | D3 | 2 | 10 | 3 | none | output port immediate <- A. |
| EI/DI | FB/F3 | 1 | 4 | 1 | none | Enable/disable maskable interrupts. |
| SIM | 30 | 1 | 4 | 1 | none | Set interrupt masks / serial output data. |
| RIM | 20 | 1 | 4 | 1 | A modified | Read interrupt masks/pending bits / serial input data. |
| HLT | 76 | 1 | 7 | 2 | none | Halt until interrupt/reset. |

---

## 16. Flag behavior summary

### 16.1 Instructions that affect all main result flags

Usually affect:

```text
S, Z, AC, P, CY
```

Examples:

```text
ADD ADC ADI ACI SUB SBB SUI SBI CMP CPI DAA
```

### 16.2 Instructions that affect S, Z, AC, P but not CY

```text
INR DCR
```

### 16.3 Instructions with special carry behavior

| Instruction | Carry behavior |
|---|---|
| `DAD` | Affects only `CY`; set if 16-bit addition overflows beyond `FFFFH`. |
| `RLC`, `RRC`, `RAL`, `RAR` | Affect only `CY`. |
| `STC` | Sets `CY = 1`. |
| `CMC` | Complements `CY`. |
| `ANA`, `ANI` | `CY` reset; `AC` set on 8085. |
| `XRA`, `XRI`, `ORA`, `ORI` | `CY` and `AC` reset. |

### 16.4 Instructions that do not normally affect flags

Most data transfer, branch, stack pointer, I/O, and machine control instructions do not affect flags:

```text
MOV MVI LXI LDA STA LHLD SHLD LDAX STAX XCHG
INX DCX
JMP CALL RET RST PCHL
PUSH POP XTHL SPHL
IN OUT EI DI SIM NOP HLT
```

Exception: `POP PSW` restores flags from the stack.

---

## 17. Practical assembly examples

### 17.1 Load, store, halt

```asm
        ORG 2000H
START:  MVI A,32H      ; A = 32H
        STA 2050H      ; memory[2050H] = A
        HLT
        END START
```

Machine code:

```text
Address  Bytes       Instruction
2000     3E 32       MVI A,32H
2002     32 50 20    STA 2050H
2005     76          HLT
```

### 17.2 Add two memory bytes

```asm
        ORG 2000H
        LDA 2050H      ; A = first number
        MOV B,A        ; B = first number
        LDA 2051H      ; A = second number
        ADD B          ; A = A + B
        STA 2052H      ; store sum
        HLT
        END
```

Machine bytes:

```text
3A 50 20   ; LDA 2050H
47         ; MOV B,A
3A 51 20   ; LDA 2051H
80         ; ADD B
32 52 20   ; STA 2052H
76         ; HLT
```

### 17.3 Copy a block using HL/DE pointers

```asm
        ORG 2000H
        LXI H,3000H    ; source pointer
        LXI D,4000H    ; destination pointer
        MVI C,05H      ; count = 5 bytes
LOOP:   MOV A,M        ; A = [HL]
        STAX D         ; [DE] = A
        INX H          ; source++
        INX D          ; dest++
        DCR C          ; count--
        JNZ LOOP
        HLT
        END
```

Key idea:

```text
HL points to source memory.
DE points to destination memory.
C is loop counter.
```

### 17.4 Stack/subroutine example

```asm
        ORG 2000H
        LXI SP,3FFFH
        MVI A,05H
        CALL DOUBLE
        HLT

DOUBLE: ADD A          ; A = A + A
        RET
        END
```

During `CALL`, 8085 pushes the return address on the stack, then jumps to `DOUBLE`. `RET` pops the return address into `PC`.

---

## 18. Common mistakes and exact corrections

### 18.1 `M` is not a register

Wrong thinking:

```text
M is another register like B/C/D.
```

Correct:

```text
M means memory[HL].
```

### 18.2 `LXI H,2050H` does not load memory data

```asm
LXI H,2050H
```

This loads the address `2050H` into `HL`; it does **not** read memory at `2050H`.

To read memory:

```asm
MOV A,M      ; after HL has address
```

or:

```asm
LDA 2050H
```

### 18.3 Hex constants starting with A-F need leading zero in Intel syntax

```asm
MVI A,0FFH   ; good
MVI A,FFH    ; unsafe/invalid in Intel assembler style
```

### 18.4 Subtraction carry means borrow

After:

```asm
SUB B
```

`CY = 1` means borrow occurred, i.e. `A < B` for unsigned comparison.

### 18.5 `INX`/`DCX` do not update flags

This surprises people.

```asm
INX H        ; flags unchanged
DCX B        ; flags unchanged
```

Use `DCR`/`INR` on an 8-bit counter if you want `Z` to change for loop tests.

---

## 19. 8085 vs 8080 summary

The 8085 was designed to be highly compatible with 8080 software. Programmer-visible differences important in normal assembly:

| Area | 8085 difference |
|---|---|
| Official new instructions | `RIM`, `SIM`. |
| Power/system integration | Single +5V supply; clock generator and system control support integrated compared with earlier 8080 support-chip design. |
| Interrupts | Adds `TRAP`, `RST 7.5`, `RST 6.5`, `RST 5.5`, plus `INTR`. |
| Serial I/O | Adds `SID`/`SOD` controlled through `RIM`/`SIM`. |
| Timing | Some conditional instruction behavior/timing differs from 8080. |
| Compatibility | Most 8080 programs run on 8085 if not timing-sensitive and not dependent on undocumented behavior. |

---

## 20. Undocumented / reserved opcodes warning

The official Intel 8085 assembly language documents `RIM` at `20H` and `SIM` at `30H`; it does **not** define normal official mnemonics for the 10 remaining reserved byte values in the opcode map:

```text
08H 10H 18H 28H 38H CBH D9H DDH EDH FDH
```

Some reverse-engineering and retrocomputing sources describe these as actual silicon-supported but undocumented instructions such as `DSUB`, `ARHL`, `RDEL`, `LDHI`, `LDSI`, `RSTV`, `SHLX`, `JNK/JNX5`, `LHLX`, and `JK/JX5`.

For accurate coursework, exams, or reliable portable code:

```text
Treat them as reserved/undocumented unless your specific assembler/emulator explicitly documents them.
```

---

## 21. Final mental model

Think of 8085 like this:

```text
A tiny 8-bit CPU where:

1. A is the main arithmetic register.
2. B,C,D,E,H,L are helper registers.
3. HL is the main memory pointer.
4. M means memory[HL].
5. PC decides the next instruction address.
6. SP manages a descending RAM stack.
7. Flags remember what happened after ALU work.
8. Every instruction is just 1 opcode byte plus maybe d8/d16/a16 bytes.
9. The external bus multiplexes low address and data to save pins.
10. Interrupts and serial I/O are small but powerful additions over 8080.
```

---

## Appendix A. Compact opcode derivation cheat sheet

```text
Register codes:
B=000 C=001 D=010 E=011 H=100 L=101 M=110 A=111

MOV d,s      = 01 ddd sss
MVI r,d8     = 00 rrr 110
INR r        = 00 rrr 100
DCR r        = 00 rrr 101
ALU r        = 10 aaa rrr

ALU aaa:
ADD=000 ADC=001 SUB=010 SBB=011 ANA=100 XRA=101 ORA=110 CMP=111

Register-pair codes for LXI/INX/DAD/DCX:
B=00 D=01 H=10 SP=11

LXI rp,d16   = 00 rp 0001
INX rp       = 00 rp 0011
DAD rp       = 00 rp 1001
DCX rp       = 00 rp 1011

Condition codes:
NZ=000 Z=001 NC=010 C=011 PO=100 PE=101 P=110 M=111

Jcc a16      = 11 ccc 010
Ccc a16      = 11 ccc 100
Rcc          = 11 ccc 000
RST n        = 11 nnn 111
```

---

## Appendix B. Minimal exam diagrams

### B.1 8085 architecture diagram

```text
              +-----------------------------------+
              |               8085                |
              |                                   |
              |  +---------+      +------------+  |
Data bus <------>| Data    |<---->| Registers  |  |
AD0-AD7       |  | buffer  |      | B C D E H L|  |
              |  +---------+      +------------+  |
              |        |                 |        |
              |        v                 v        |
              |  +-----------------------------+  |
              |  |      8-bit internal bus     |  |
              |  +-----------------------------+  |
              |        |                 |        |
              |   +----v----+       +----v----+   |
              |   |   ALU   |<----->|   A     |   |
              |   +----+----+       +---------+   |
              |        |                 |        |
              |   +----v----+       +----v----+   |
              |   | Flags   |       | PC / SP |   |
              |   +---------+       +---------+   |
              |                                   |
              | Instruction decoder + control     |
              +-----------------------------------+
                    |       |       |       |
                   ALE     RD#     WR#    IO/M,S1,S0
```

### B.2 Multiplexed address/data bus

```text
T1: AD7-AD0 carry A7-A0
    ALE pulses high, external latch stores A7-A0

T2/T3: AD7-AD0 carry data D7-D0

8085 AD0-AD7 -----> [Latch] -----> A0-A7 to memory
        |
        +------------------------> D0-D7 data bus
```

### B.3 Stack growth

```text
Before PUSH: SP = 4000H

4000H  <- SP
3FFFH
3FFEH

After PUSH pair:

4000H
3FFFH  high byte
3FFEH  low byte  <- SP
```
