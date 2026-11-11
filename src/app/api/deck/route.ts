import type { NextRequest } from 'next/server';
import { checkOrigin, requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { allDeckKinds, validateDeckCards, validateDeckWithSignature } from '@/lib/game/deck';
import { isValidSignatureMove, signatureMoveOptions } from '@/lib/game/engine-config';
import { badRequest, forbidden, handleError, notFound, ok, parseJson } from '@/lib/http';
import { Fighter } from '@/models/Fighter';
import { FighterDeck } from '@/models/FighterDeck';

/**
 * GET /api/deck — deck saya + daftar jurus yang bisa dipilih + opsi signature.
 * PUT /api/deck — simpan deck { cards: string[] (maks 6), signature: string|null }.
 * Signature divalidasi terhadap gaya fighter (harus jurus khas yang valid
 * untuk gaya itu) dan tidak boleh duplikat dengan kartu. PUT menulis
 * FighterDeck.signature SEKALIGUS Fighter.signatureMove supaya keduanya
 * tidak pernah divergen (engine membaca signature dari objek fighter).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    await connectDB();

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw notFound('Buat fighter dulu sebelum mengatur deck');

    const deckDoc = await FighterDeck.findOne({ fighterId: fighter._id }).lean();
    return ok({
      cards: deckDoc?.cards ?? [],
      signature: deckDoc?.signature ?? fighter.signatureMove ?? null,
      style: fighter.style,
      availableKinds: allDeckKinds(),
      signatureOptions: signatureMoveOptions(fighter.style),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!checkOrigin(req)) throw forbidden('Origin tidak valid');
    const session = await requireAuth(req);
    const body = await parseJson(req);
    await connectDB();

    const fighter = await Fighter.findOne({ userId: session.userId, status: 'active' });
    if (!fighter) throw notFound('Buat fighter dulu sebelum mengatur deck');

    const cards = validateDeckCards(body.cards);
    let signature: string | null = null;
    if (body.signature !== undefined && body.signature !== null) {
      if (typeof body.signature !== 'string' || !body.signature.trim()) {
        throw badRequest('Signature harus berupa nama jurus atau null');
      }
      signature = body.signature.trim();
      if (!isValidSignatureMove(fighter.style, signature)) {
        throw badRequest(`Jurus khas tidak valid untuk gaya ${fighter.style}: ${signature}`);
      }
    }
    validateDeckWithSignature(cards, signature);

    const deckDoc = await FighterDeck.findOneAndUpdate(
      { fighterId: fighter._id },
      { $set: { cards, signature } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    // Cermin ke Fighter.signatureMove (engine membaca dari objek fighter).
    if ((fighter.signatureMove ?? null) !== signature) {
      fighter.signatureMove = signature;
      await fighter.save();
    }

    return ok({
      cards: deckDoc.cards,
      signature: deckDoc.signature ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}
