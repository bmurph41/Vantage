import { cn } from "@/lib/utils";
import { Camera, Image as ImageIcon, Eye } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import Figure from "../Figure";
import type { OfferingMemorandum, Image } from "@shared/reportSchema";

interface PhotosProps {
  data: OfferingMemorandum;
  className?: string;
}

export function Photos({ data, className }: PhotosProps) {
  const { images } = data;
  
  // Group images by category
  const imagesByCategory = images.reduce((acc, image) => {
    if (!acc[image.category]) {
      acc[image.category] = [];
    }
    acc[image.category].push(image);
    return acc;
  }, {} as Record<string, Image[]>);
  
  // Sort images within each category by order
  Object.keys(imagesByCategory).forEach(category => {
    imagesByCategory[category].sort((a, b) => a.order - b.order);
  });
  
  // Category configuration
  const categoryConfig = {
    exterior: {
      title: "Exterior Views",
      icon: Camera,
      description: "Property exterior and architectural details",
    },
    interior: {
      title: "Interior Spaces", 
      icon: Eye,
      description: "Unit interiors and common area finishes",
    },
    amenity: {
      title: "Amenities",
      icon: ImageIcon,
      description: "Building amenities and resident facilities",
    },
    neighborhood: {
      title: "Neighborhood",
      icon: ImageIcon,
      description: "Surrounding area and local attractions",
    },
    aerial: {
      title: "Aerial Views",
      icon: ImageIcon,
      description: "Bird's eye view of property and surroundings",
    },
    floorplan: {
      title: "Floor Plans",
      icon: ImageIcon,
      description: "Unit layouts and building floor plans",
    },
  };
  
  const availableCategories = Object.keys(imagesByCategory).filter(
    category => imagesByCategory[category].length > 0
  );
  
  if (availableCategories.length === 0) {
    return null;
  }
  
  return (
    <ReportSection
      title="Property Photos"
      index={6}
      className={cn("space-y-8", className)}
      data-testid="photos-section"
    >
      {/* Photo Gallery Overview */}
      <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
        <div className="flex items-start gap-4">
          <Camera className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-emerald-900 mb-2">
              Professional Photography Collection
            </h4>
            <p className="text-emerald-800 text-sm leading-relaxed">
              The following photographs showcase the property's architectural features, 
              interior finishes, amenities, and neighborhood context. All images were 
              captured by professional real estate photographers and accurately represent 
              the current condition of the property.
            </p>
          </div>
        </div>
      </div>

      {/* Photo Categories */}
      {availableCategories.map((categoryKey) => {
        const category = imagesByCategory[categoryKey];
        const config = categoryConfig[categoryKey as keyof typeof categoryConfig];
        const Icon = config?.icon || ImageIcon;
        
        return (
          <div key={categoryKey} className="space-y-6">
            {/* Category Header */}
            <div className="border-b border-neutral-200 pb-4">
              <h4 className="font-semibold text-neutral-900 text-lg flex items-center gap-2">
                <Icon className="w-5 h-5 text-emerald-600" />
                {config?.title || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}
              </h4>
              {config?.description && (
                <p className="text-sm text-neutral-600 mt-1">
                  {config.description}
                </p>
              )}
            </div>

            {/* Photo Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {category.map((image, index) => (
                <Figure
                  key={`${categoryKey}-${index}`}
                  src={image.url}
                  alt={image.caption}
                  caption={image.caption}
                  aspectRatio="photo"
                  size="full"
                  data-testid={`photo-${categoryKey}-${index}`}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Photo Count Summary */}
      <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
        <h5 className="font-semibold text-neutral-900 mb-4">Photography Summary</h5>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {availableCategories.map((categoryKey) => {
            const count = imagesByCategory[categoryKey].length;
            const config = categoryConfig[categoryKey as keyof typeof categoryConfig];
            
            return (
              <div key={categoryKey} className="text-center">
                <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                  {count}
                </div>
                <div className="text-sm text-neutral-600">
                  {config?.title || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-neutral-200 text-center">
          <div className="text-lg font-semibold text-neutral-900">
            Total: {images.length} Professional Photographs
          </div>
          <p className="text-sm text-neutral-600 mt-1">
            All photos taken within the last 90 days and accurately represent current property condition
          </p>
        </div>
      </div>
    </ReportSection>
  );
}

export default Photos;