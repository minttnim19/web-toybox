// Pixel particles in a fixed-size ring buffer: when full, the oldest particle is reused,
// so the count can never exceed MAX_PARTICLES.

export const MAX_PARTICLES = 1800;
const GRAVITY = 900; // px/s²

export class Particles {
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  /** Size in canvas (low-res) pixels. */
  private readonly size = new Uint8Array(MAX_PARTICLES);
  private readonly gravity = new Float32Array(MAX_PARTICLES);
  private readonly color: string[] = new Array<string>(MAX_PARTICLES).fill('');
  private head = 0;

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    size = 1,
    gravity = 1,
  ): void {
    const i = this.head;
    this.head = (this.head + 1) % MAX_PARTICLES;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = this.maxLife[i] = life;
    this.size[i] = size;
    this.gravity[i] = gravity;
    this.color[i] = color;
  }

  /** Small burst of sparks at a hit point (viewport px). */
  sparks(x: number, y: number, colors: readonly string[]): void {
    for (let n = 0; n < 6; n++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 160;
      const color = colors[Math.floor(Math.random() * colors.length)]!;
      this.spawn(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s - 40,
        0.2 + Math.random() * 0.2,
        color,
        1,
        0.3,
      );
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i]! -= dt;
      this.vy[i]! += GRAVITY * this.gravity[i]! * dt;
      this.x[i]! += this.vx[i]! * dt;
      this.y[i]! += this.vy[i]! * dt;
    }
  }

  /** Move all particles, e.g. to keep debris attached to the page while it scrolls. */
  shift(dx: number, dy: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i]! <= 0) continue;
      this.x[i]! += dx;
      this.y[i]! += dy;
    }
  }

  clear(): void {
    this.life.fill(0);
  }

  get activeCount(): number {
    let n = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) if (this.life[i]! > 0) n++;
    return n;
  }

  /** Draw onto a low-res canvas where 1 canvas pixel = `scale` CSS pixels. */
  draw(ctx: CanvasRenderingContext2D, scale: number, width: number, height: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life = this.life[i]!;
      if (life <= 0) continue;
      const px = Math.floor(this.x[i]! / scale);
      const py = Math.floor(this.y[i]! / scale);
      const s = this.size[i]!;
      if (px + s < 0 || py + s < 0 || px > width || py > height) continue;
      ctx.globalAlpha = Math.min(1, (life / this.maxLife[i]!) * 2.5);
      ctx.fillStyle = this.color[i]!;
      ctx.fillRect(px, py, s, s);
    }
    ctx.globalAlpha = 1;
  }
}
