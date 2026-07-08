interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export function BrandLogo({ className = "", alt = "" }: BrandLogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}col.png`}
      alt={alt}
      className={className}
      draggable={false}
    />
  );
}
