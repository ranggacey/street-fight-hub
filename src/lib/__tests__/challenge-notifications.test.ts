import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_POPUP_TYPES,
  formatChallengeNotification,
  pickUnseenNotifications,
} from '@/lib/game/challenge-notifications';

describe('formatChallengeNotification', () => {
  it('challenge_received (langsung): menyebut penantang + yang ditantang', () => {
    const text = formatChallengeNotification('challenge_received', {
      challengerName: 'NOPE BOY',
      challengedName: 'DAYROT JAGOAN',
      kind: 'direct',
    });
    expect(text.title).toBe('Tantangan baru!');
    expect(text.body).toContain('NOPE BOY');
    expect(text.body).toContain('DAYROT JAGOAN');
    expect(text.href).toBe('/tantangan');
  });

  it('challenge_received (terbuka): kalimat "menantangmu" tanpa nama kosong', () => {
    const text = formatChallengeNotification('challenge_received', {
      challengerName: 'NOPE BOY',
      kind: 'open',
    });
    expect(text.body).toContain('NOPE BOY');
    expect(text.body).toContain('menantangmu');
    expect(text.body).not.toContain('undefined');
  });

  it('challenge_accepted: menyebut penerima tantangan', () => {
    const text = formatChallengeNotification('challenge_accepted', {
      challengerName: 'NOPE BOY',
      challengedName: 'DAYROT JAGOAN',
      kind: 'direct',
    });
    expect(text.title).toBe('Tantangan diterima!');
    expect(text.body).toContain('DAYROT JAGOAN');
  });

  it('challenge_accepted (terbuka): penerima adalah yang menerima open', () => {
    const text = formatChallengeNotification('challenge_accepted', {
      challengerName: 'NOPE BOY',
      challengedName: 'SIJAGOAN BATAK',
      kind: 'open',
    });
    expect(text.body).toContain('SIJAGOAN BATAK');
    expect(text.body).toContain('tantangan terbukamu');
  });

  it('challenge_declined: menyebut yang menolak', () => {
    const text = formatChallengeNotification('challenge_declined', {
      challengedName: 'DAYROT JAGOAN',
    });
    expect(text.title).toBe('Tantangan ditolak');
    expect(text.body).toContain('DAYROT JAGOAN');
  });

  it('tanpa nama sama sekali: fallback generik, tidak ada undefined/kosong', () => {
    for (const type of CHALLENGE_POPUP_TYPES) {
      const text = formatChallengeNotification(type, null);
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.body.length).toBeGreaterThan(0);
      expect(text.body).not.toContain('undefined');
      expect(text.body).not.toContain('null');
    }
  });
});

describe('pickUnseenNotifications', () => {
  const items = [
    { id: 'a', type: 'challenge_received', read: false },
    { id: 'b', type: 'challenge_accepted', read: false },
    { id: 'c', type: 'challenge_received', read: false },
    { id: 'd', type: 'fight_result', read: false },
    { id: 'e', type: 'challenge_received', read: true },
    { id: 'f', type: 'title_won', read: false },
  ];

  it('hanya tipe tantangan yang belum dibaca dan belum dilihat', () => {
    const out = pickUnseenNotifications(items, new Set(['c']));
    expect(out.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('tanpa seen: semua tantangan unread masuk, fight_result/title tidak', () => {
    const out = pickUnseenNotifications(items, new Set());
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('item tanpa id dilewati (tidak bisa didedup)', () => {
    const out = pickUnseenNotifications(
      [{ type: 'challenge_received', read: false }],
      new Set(),
    );
    expect(out).toEqual([]);
  });
});
