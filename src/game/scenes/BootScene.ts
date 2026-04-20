import { Scene } from 'phaser';

export class BootScene extends Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    const start = () => this.scene.start('Grid');
    if (fonts && typeof fonts.ready?.then === 'function') {
      fonts.ready.then(start, start);
    } else {
      start();
    }
  }
}
