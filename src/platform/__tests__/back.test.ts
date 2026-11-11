import { describe, expect, it } from 'vitest';
import { BACK_PRIORITY_OVERLAY, BACK_PRIORITY_SCREEN, handleBack, pushBackHandler } from '../back';

describe('back handler stack', () => {
  it('reports unhandled when nothing is registered (the platform then leaves the app)', () => {
    expect(handleBack()).toBe(false);
  });

  it('runs the most recently registered screen handler', () => {
    const calls: string[] = [];
    const offTier = pushBackHandler(() => calls.push('tier'));
    const offLevel = pushBackHandler(() => calls.push('level'));
    expect(handleBack()).toBe(true);
    offLevel();
    expect(handleBack()).toBe(true);
    offTier();
    expect(calls).toEqual(['level', 'tier']);
    expect(handleBack()).toBe(false);
  });

  it('lets an overlay win over a screen however the two were registered', () => {
    const calls: string[] = [];
    const offOverlay = pushBackHandler(() => calls.push('overlay'), BACK_PRIORITY_OVERLAY);
    const offScreen = pushBackHandler(() => calls.push('screen'), BACK_PRIORITY_SCREEN);
    handleBack();
    offOverlay();
    handleBack();
    offScreen();
    expect(calls).toEqual(['overlay', 'screen']);
  });

  it('unregistering twice is harmless and removes only its own handler', () => {
    const calls: string[] = [];
    const offA = pushBackHandler(() => calls.push('a'));
    const offB = pushBackHandler(() => calls.push('b'));
    offA();
    offA();
    handleBack();
    offB();
    expect(calls).toEqual(['b']);
    expect(handleBack()).toBe(false);
  });
});
