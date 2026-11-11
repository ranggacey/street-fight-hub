import type { Metadata } from 'next';
import TrainingClient from '@/components/TrainingClient';

export const metadata: Metadata = {
  title: 'Latihan — Street Fight Hub',
  description:
    'Latihan push-up dan squat lewat kamera untuk menaikkan stat petarung, lalu atur deck jurus untuk fight berikutnya.',
};

export default function LatihanPage() {
  return <TrainingClient />;
}
