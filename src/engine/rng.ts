export class Rng {
  private s: number
  constructor(seed: number) { this.s = seed >>> 0 }
  next(): number {
    this.s |= 0; this.s = (this.s + 0x6D2B79F5) | 0
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(min: number, max: number) { return min + this.next() * (max - min) }
  int(min: number, max: number) { return Math.floor(this.range(min, max + 1)) }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.next() * arr.length)] }
  bool(p = 0.5) { return this.next() < p }
}
