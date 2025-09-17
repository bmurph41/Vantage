import { cn } from "@/lib/utils";

interface FigureProps {
  src: string;
  alt: string;
  caption?: string;
  aspectRatio?: "square" | "video" | "photo" | "portrait" | "golden";
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
  imageClassName?: string;
  captionClassName?: string;
}

export function Figure({
  src,
  alt,
  caption,
  aspectRatio = "photo",
  size = "full", 
  className,
  imageClassName,
  captionClassName,
}: FigureProps) {
  const aspectRatioClasses = {
    square: "aspect-square",
    video: "aspect-video",
    photo: "aspect-[4/3]",
    portrait: "aspect-[3/4]",
    golden: "aspect-[1.618/1]",
  };
  
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg", 
    full: "w-full",
  };
  
  return (
    <figure 
      className={cn(
        "space-y-3",
        sizeClasses[size],
        className
      )}
      data-testid="report-figure"
    >
      {/* Image Container */}
      <div 
        className={cn(
          "overflow-hidden rounded-lg border border-neutral-200",
          aspectRatioClasses[aspectRatio]
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-transform duration-300",
            "hover:scale-105",
            imageClassName
          )}
          loading="lazy"
          data-testid="report-figure-image"
        />
      </div>
      
      {/* Caption */}
      {caption && (
        <figcaption 
          className={cn(
            "text-sm text-neutral-600 font-medium leading-relaxed",
            "text-center",
            captionClassName
          )}
          data-testid="report-figure-caption"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export default Figure;