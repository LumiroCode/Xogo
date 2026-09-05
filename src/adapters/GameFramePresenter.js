/**
 * Converts domain-level transient events into renderer-generic effects.
 * The renderer knows only lines/projectiles/rings, never shots, artillery or factions.
 */
export class GameFramePresenter {
  present(frame) {
    return {
      fog: frame.fog,
      commandMarker: frame.commandMarker,
      effects: (frame.events ?? []).flatMap(e => this._effect(e)).filter(Boolean)
    };
  }

  _effect(e) {
    const age = e.duration > 0 ? Math.max(0, Math.min(1, e.age / e.duration)) : 1;
    const alpha = Math.max(0, 1 - age);
    const friendly = e.faction === 'human';
    const lineColor = friendly ? '#bfe1ff' : '#ffc3bd';
    const warm = friendly ? '#ffe09b' : '#ffb29b';

    if (e.type === 'direct_shot') {
      return [{
        kind: 'line', from: e.from, to: e.to,
        color: lineColor, width: e.hit ? 2.4 : 1.5,
        alpha, endDot: e.hit ? 3.0 : 1.5
      }];
    }
    if (e.type === 'artillery_round') {
      const progress = Math.max(0, Math.min(1, e.age / Math.max(0.001, e.duration)));
      return [
        {kind:'line', from:e.from, to:e.to, color:warm, width:1, alpha:0.24, dashed:true},
        {kind:'projectile', from:e.from, to:e.to, progress, color:warm, radius:4, alpha:1}
      ];
    }
    if (e.type === 'impact') {
      return [{
        kind:'ring', at:e.at, radius:e.radius, progress:age,
        color:warm, width:3, alpha
      }];
    }
    return [];
  }
}
