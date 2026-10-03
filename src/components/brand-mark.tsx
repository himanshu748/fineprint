import Image from 'next/image';

export function BrandMark() {
  return (
    <Image
      className="brand-mark"
      src="/brand/fineprint-mark.png"
      alt=""
      width={40}
      height={40}
      unoptimized
    />
  );
}
