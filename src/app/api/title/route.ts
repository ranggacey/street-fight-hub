import { connectDB } from '@/lib/db';
import { getTitlePublic } from '@/lib/game/title-service';
import { handleError, ok } from '@/lib/http';

/** GET /api/title — holder saat ini + progres race + countdown kekosongan. */
export async function GET() {
  try {
    await connectDB();
    const data = await getTitlePublic();
    return ok({ title: data });
  } catch (err) {
    return handleError(err);
  }
}
