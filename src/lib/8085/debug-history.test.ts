import { step8085, type I8085Registers } from "./cpu";

const originalWarn = console.warn;
console.warn = () => undefined;
const { useFileStore } = await import("@/stores/file-store");

const store = useFileStore.getState();
store.setArchitecture("8085");
useFileStore.getState().resetExecution();
useFileStore.getState().setMemoryBulk([
  { address: 0x1000, value: 0x3e },
  { address: 0x1001, value: 0x05 },
  { address: 0x1002, value: 0x32 },
  { address: 0x1003, value: 0x00 },
  { address: 0x1004, value: 0x20 },
]);
useFileStore.getState().setRegister("PC", 0x1000);

const execute = () => {
  const state = useFileStore.getState();
  const result = step8085(
    state.registers as I8085Registers,
    state.memory,
    state.ports,
  );
  state.apply8085Step(
    result.registers,
    result.memoryWrites,
    result.portWrites,
    result.timing,
  );
};

execute();
execute();

let state = useFileStore.getState();
if (state.execution.i8085History.length !== 2) {
  throw new Error("Debug history did not record both instructions");
}
if (state.execution.i8085Cursor !== 2 || state.memory[0x2000] !== 5) {
  throw new Error("Forward execution state mismatch");
}

state.step8085Backward();
state = useFileStore.getState();
if (
  state.execution.i8085Cursor !== 1 ||
  state.memory[0x2000] !== 0 ||
  state.registers.A !== 5 ||
  state.registers.PC !== 0x1002
) {
  throw new Error("First reverse step did not restore memory and registers");
}

state.step8085Backward();
state = useFileStore.getState();
if (
  state.execution.i8085Cursor !== 0 ||
  state.registers.A !== 0 ||
  state.registers.PC !== 0x1000
) {
  throw new Error("Second reverse step did not restore initial state");
}

state.step8085Forward();
state.step8085Forward();
state = useFileStore.getState();
if (
  state.execution.i8085Cursor !== 2 ||
  state.memory[0x2000] !== 5 ||
  state.registers.PC !== 0x1005
) {
  throw new Error("Forward replay did not restore final state");
}

console.warn = originalWarn;
console.log("8085 reversible debug history tests passed");
