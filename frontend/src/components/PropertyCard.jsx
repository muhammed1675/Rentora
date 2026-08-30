import { Link } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { ImageWatermark } from './ImageWatermark';
import { propertyImageSrc } from '../lib/images';

export function PropertyCard({ property }) {
  const formatPrice = (price) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(price || 0);

  const typeLabel = property.property_type
    ? property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)
    : 'Home';

  const isUnavailable = property.status === 'unavailable' || property.availability === 'unavailable';

  return (
    <article className="group min-w-0" data-testid={`property-card-${property.id}`}>
      <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-[hsl(60_8%_90%)]">
        <Link to={`/property/${property.slug || property.id}`} aria-label={`View ${property.title}`}>
          <img
            src={propertyImageSrc(property.images?.[0]) || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg?auto=compress&cs=tinysrgb&w=800'}
            alt={property.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy" decoding="async" width="800" height="600" />
        </Link>
        <ImageWatermark size="sm" />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
          {typeLabel}
        </span>
        {isUnavailable && (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-[hsl(210_53%_13%)]/90 px-3 py-2 text-center text-xs font-semibold text-white">
            Taken
          </div>
        )}
      </div>
      <div className="px-1 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/property/${property.slug || property.id}`} className="font-heading text-lg font-semibold text-foreground hover:text-primary line-clamp-1">
              {property.title}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground line-clamp-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {property.location}
            </p>
            {property.address && (
              <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-muted/40 px-2 py-1.5">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Address
                </span>
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                  {property.address}
                </p>
              </div>
            )}
          </div>
          <p className="whitespace-nowrap text-sm font-semibold text-foreground">
            {formatPrice(property.price)}
            <span className="font-normal text-muted-foreground">/yr</span>
          </p>
        </div>
        {property.google_maps_link && (
          <div className="mt-4 flex items-center justify-end border-t border-black/5 pt-3">
            <a
              href={property.google_maps_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              <Navigation className="h-3.5 w-3.5" />
              Get Directions
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="min-w-0">
      <div className="aspect-[5/4] rounded-2xl bg-[hsl(60_8%_90%)] animate-pulse" />
      <div className="px-1 pb-2 pt-4 space-y-3">
        <div className="h-5 bg-muted rounded animate-pulse" />
        <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
      </div>
    </div>
  );
}

export default PropertyCard;
