import fs from 'fs';

export class PIDManager {
  constructor(private pidFile: string) {}

  write(pid: number): void {
    fs.writeFileSync(this.pidFile, pid.toString());
  }

  read(): number | null {
    try {
      const pid = fs.readFileSync(this.pidFile, 'utf8');
      return parseInt(pid, 10);
    } catch {
      return null;
    }
  }

  remove(): void {
    try {
      fs.unlinkSync(this.pidFile);
    } catch {
      // Ignore errors
    }
  }
}