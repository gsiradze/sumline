import { Geom, Scene, Scenes } from 'phaser';
import type { GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { colors, hex, layout, motion } from '../rendering/tokens';
import { CELL_COUNT, Feedback, GRID_SIZE, GameOutcome } from '../domain/types';
import type { ActiveGameState } from '../domain/game-state';

type CellVisualState = 'empty' | 'marked' | 'marked-wrong' | 'locked-filled' | 'locked-empty';

export class GridScene extends Scene {
  private state: ActiveGameState | null = null;
  private cellGfx: GameObjects.Graphics[] = [];
  private cellHits: GameObjects.Zone[] = [];
  private rowTexts: GameObjects.Text[] = [];
  private colTexts: GameObjects.Text[] = [];
  private originX = 0;
  private originY = 0;
  private destroyed = false;

  constructor() {
    super('Grid');
  }

  create(): void {
    this.destroyed = false;
    this.cameras.main.setBackgroundColor(colors.paper100);

    const gridWidth = GRID_SIZE * layout.cellSize + (GRID_SIZE - 1) * layout.cellGap;
    this.originX = Math.round((this.scale.width - gridWidth) / 2);
    this.originY = layout.gridOriginY;

    this.buildCells();
    this.buildClueTexts();

    EventBus.on('state-updated', this.handleStateUpdated, this);
    const cleanup = (): void => {
      this.destroyed = true;
      EventBus.off('state-updated', this.handleStateUpdated, this);
    };
    this.events.once(Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Scenes.Events.DESTROY, cleanup);

    EventBus.emit('scene-ready', 'Grid');
  }

  private buildCells(): void {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = this.originX + c * (layout.cellSize + layout.cellGap);
        const y = this.originY + r * (layout.cellSize + layout.cellGap);
        const g = this.add.graphics({ x, y });
        this.drawCell(g, 'empty');
        this.cellGfx.push(g);

        const zone = this.add
          .zone(x, y, layout.cellSize, layout.cellSize)
          .setOrigin(0, 0)
          .setInteractive({
            hitArea: new Geom.Rectangle(0, 0, layout.cellSize, layout.cellSize),
            hitAreaCallback: Geom.Rectangle.Contains,
            useHandCursor: true,
          });
        const idx = r * GRID_SIZE + c;
        zone.on('pointerup', () => this.handleCellTapped(idx));
        this.cellHits.push(zone);
      }
    }
  }

  private buildClueTexts(): void {
    const style = {
      fontFamily: 'Fraunces, Georgia, serif',
      fontSize: `${layout.clueFontSize}px`,
      fontStyle: '500',
      color: hex.ink700,
    };
    for (let r = 0; r < GRID_SIZE; r++) {
      const y = this.originY + r * (layout.cellSize + layout.cellGap) + layout.cellSize / 2;
      const x = this.originX - layout.clueGutter;
      const t = this.add.text(x, y, '', style).setOrigin(0.5, 0.5);
      this.rowTexts.push(t);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      const x = this.originX + c * (layout.cellSize + layout.cellGap) + layout.cellSize / 2;
      const y = this.originY - layout.clueGutter;
      const t = this.add.text(x, y, '', style).setOrigin(0.5, 0.5);
      this.colTexts.push(t);
    }
  }

  private handleStateUpdated = (state: ActiveGameState): void => {
    if (this.destroyed) return;
    if (!this.sys || !this.sys.isActive()) return;
    const prev = this.state;
    const isNewPuzzle = prev?.puzzle !== state.puzzle;
    const becameLost =
      prev?.outcome !== GameOutcome.Lost && state.outcome === GameOutcome.Lost;
    const becameWon =
      prev?.outcome !== GameOutcome.Won && state.outcome === GameOutcome.Won;
    this.state = state;

    if (isNewPuzzle) {
      for (let r = 0; r < GRID_SIZE; r++) {
        const t = this.rowTexts[r];
        if (t && t.scene) t.setText(String(state.puzzle.rowSums[r] ?? ''));
      }
      for (let c = 0; c < GRID_SIZE; c++) {
        const t = this.colTexts[c];
        if (t && t.scene) t.setText(String(state.puzzle.colSums[c] ?? ''));
      }
    }

    if (becameLost) {
      this.playLoseReveal();
      return;
    }
    if (becameWon) {
      this.playWinShimmer();
      return;
    }
    this.redrawAllCells();
  };

  private playLoseReveal(): void {
    for (let i = 0; i < CELL_COUNT; i++) {
      const g = this.cellGfx[i];
      if (!g) continue;
      this.tweens.killTweensOf(g);
      const delay = i * 16;
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0.25 },
        duration: 180,
        delay,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.drawCell(g, this.visualStateFor(i));
          this.tweens.add({
            targets: g,
            alpha: { from: 0.25, to: 1 },
            duration: 360,
            ease: 'Quad.easeOut',
          });
        },
      });
    }
  }

  private playWinShimmer(): void {
    this.redrawAllCells();
    for (let i = 0; i < CELL_COUNT; i++) {
      const g = this.cellGfx[i];
      if (!g) continue;
      this.tweens.killTweensOf(g);
      const delay = i * 22;
      this.tweens.add({
        targets: g,
        scale: { from: 1, to: 1.08 },
        duration: 180,
        delay,
        ease: 'Quad.easeOut',
        yoyo: true,
      });
    }
  }

  private handleCellTapped(index: number): void {
    if (!this.state) return;
    if (this.state.outcome !== GameOutcome.InProgress) return;
    if (this.state.lockedFilled[index] || this.state.lockedEmpty[index]) return;
    const g = this.cellGfx[index];
    if (g) this.nudge(g);
    EventBus.emit('cell-tapped', index);
  }

  private nudge(target: GameObjects.Graphics): void {
    this.tweens.killTweensOf(target);
    target.setScale(1);
    this.tweens.add({
      targets: target,
      scale: { from: 0.94, to: 1 },
      duration: motion.nudgeMs,
      ease: 'Cubic.easeOut',
    });
  }

  private redrawAllCells(): void {
    for (let i = 0; i < CELL_COUNT; i++) {
      const g = this.cellGfx[i];
      if (!g) continue;
      this.drawCell(g, this.visualStateFor(i));
    }
  }

  private visualStateFor(i: number): CellVisualState {
    if (!this.state) return 'empty';
    if (this.state.outcome === GameOutcome.Lost) {
      return this.state.puzzle.solution[i] === 1 ? 'locked-filled' : 'locked-empty';
    }
    if (this.state.lockedFilled[i]) return 'locked-filled';
    if (this.state.lockedEmpty[i]) return 'locked-empty';
    if (this.state.currentMarks[i] === 1) {
      const feedbacks = this.state.feedbacks;
      const guesses = this.state.guesses;
      const lastFb = feedbacks[feedbacks.length - 1];
      const lastGuess = guesses[guesses.length - 1];
      if (
        lastFb &&
        lastGuess &&
        lastGuess[i] === 1 &&
        lastFb[i] === Feedback.Red
      ) {
        return 'marked-wrong';
      }
      return 'marked';
    }
    return 'empty';
  }

  private drawCell(g: GameObjects.Graphics, state: CellVisualState): void {
    const size = layout.cellSize;
    const radius = layout.cellRadius;
    g.clear();

    switch (state) {
      case 'empty':
        g.fillStyle(colors.paper50, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.lineStyle(1, colors.rule200, 1);
        g.strokeRoundedRect(0.5, 0.5, size - 1, size - 1, radius);
        break;
      case 'marked':
        g.fillStyle(colors.inkFill800, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.fillStyle(colors.inkFill900, 0.45);
        g.fillRoundedRect(0, 0, size, 4, radius);
        g.fillStyle(0xffffff, 0.04);
        g.fillRoundedRect(0, size - 3, size, 3, radius);
        break;
      case 'marked-wrong':
        g.fillStyle(colors.clay500, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.lineStyle(1.5, colors.clay700, 0.9);
        g.strokeRoundedRect(0.5, 0.5, size - 1, size - 1, radius);
        g.fillStyle(colors.clay700, 0.4);
        g.fillRoundedRect(0, 0, size, 4, radius);
        g.fillStyle(0xffffff, 0.06);
        g.fillRoundedRect(0, size - 3, size, 3, radius);
        break;
      case 'locked-filled':
        g.fillStyle(colors.sage500, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.lineStyle(1, colors.sage600, 1);
        g.strokeRoundedRect(0.5, 0.5, size - 1, size - 1, radius);
        g.fillStyle(colors.sage700, 0.55);
        g.fillCircle(size - 12, 12, 5);
        break;
      case 'locked-empty': {
        g.fillStyle(colors.sage100, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.lineStyle(1, colors.sage300, 1);
        g.strokeRoundedRect(0.5, 0.5, size - 1, size - 1, radius);
        const mid = size / 2;
        const dashHalf = 8;
        g.lineStyle(2.5, colors.sage600, 0.55);
        g.beginPath();
        g.moveTo(mid - dashHalf, mid);
        g.lineTo(mid + dashHalf, mid);
        g.strokePath();
        break;
      }
    }
  }
}
