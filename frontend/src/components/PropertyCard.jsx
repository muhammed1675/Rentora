import { Link } from 'react-router-dom';
import { MapPin, Home, Building } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card } from './ui/card';

export function PropertyCard({ property }) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(price);
  };

  const TypeIcon = property.property_type === 'hostel' ? Home : Building;

  return (
    <Link to={`/property/${property.id}`} data-testid={`property-card-${property.id}`}>
      <Card className="group overflow-hidden border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={property.images?.[0] || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {/* Type Badge */}
          <Badge
            variant="secondary"
            className="absolute top-3 left-3 gap-1 bg-white/95 text-foreground border border-border/40 shadow-sm font-medium"
          >
            <TypeIcon className="w-3 h-3" />
            {property.property_type}
          </Badge>
          {/* Price Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-10">
            <p className="text-xl font-bold text-white tracking-tight drop-shadow">
              {formatPrice(property.price)}
              <span className="text-sm font-normal text-white/80">/year</span>
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-base line-clamp-1 text-foreground group-hover:text-primary transition-colors">
            {property.title}
          </h3>
          <div className="flex items-center gap-1 mt-1.5 text-foreground/55">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm line-clamp-1">{property.location}</span>
            {property.google_maps_link && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(property.google_maps_link, '_blank', 'noopener,noreferrer'); }}
                className="ml-1 text-xs text-primary hover:underline shrink-0 whitespace-nowrap cursor-pointer"
              >
                View map
              </span>
            )}
          </div>
          {property.description && (
            <p className="text-sm text-foreground/55 mt-2 line-clamp-2 leading-relaxed">
              {property.description}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

export function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden border border-border/50">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-muted rounded animate-pulse" />
        <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
        <div className="h-4 bg-muted rounded animate-pulse" />
      </div>
    </Card>
  );
}

export default PropertyCard;