import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { propertyAPI, locationAPI } from '../lib/api';
import { propertyImageSrc } from '../lib/images';
import { PropertyCard, PropertyCardSkeleton } from '../components/PropertyCard';
import { AdSlot } from '../components/AdSlot';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Card } from '../components/ui/card';
import { Search, SlidersHorizontal, X, Home, Building, RefreshCw, Heart, Clock, MapPin, GitCompare } from 'lucide-react';
import { toast } from 'sonner';


// ── localStorage helpers ─────────────────────────────────────────────────────
function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem('rentora_recently_viewed') || '[]'); }
  catch { return []; }
}
function getFavourites() {
  try { return JSON.parse(localStorage.getItem('rentora_favourites') || '[]'); }
  catch { return []; }
}
function toggleFavourite(id) {
  const favs = getFavourites();
  const idx = favs.indexOf(id);
  if (idx === -1) { favs.push(id); } else { favs.splice(idx, 1); }
  localStorage.setItem('rentora_favourites', JSON.stringify(favs));
  return idx === -1;
}
function getCompareList() {
  try { return JSON.parse(localStorage.getItem('rentora_compare') || '[]'); }
  catch { return []; }
}

// ── Mini card for recently viewed ────────────────────────────────────────────
function RecentCard({ item, isFav, onToggleFav }) {
  const navigate = useNavigate();
  const fmt = (p) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(p);
  const TypeIcon = item.property_type === 'hostel' ? Home : Building;
  return (
    <div onClick={() => navigate(`/property/${item.id}`)} className="shrink-0 w-48 rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow group">
      <div className="relative h-28 bg-muted overflow-hidden">
        {item.image
          ? <img src={propertyImageSrc(item.image)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" width="800" height="600" />
          : <div className="w-full h-full flex items-center justify-center bg-muted"><TypeIcon className="w-8 h-8 text-muted-foreground/40" /></div>
        }
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(item.id); }}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${isFav ? 'bg-red-500 text-white' : 'bg-black/30 text-white hover:bg-black/50'}`}>
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
        </button>
      </div>
      <div className="p-3">
        <p className="font-semibold text-xs line-clamp-1">{item.title}</p>
        <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
          <MapPin className="w-3 h-3" /><span className="text-xs line-clamp-1">{item.location}</span>
        </div>
        <p className="text-primary font-bold text-xs mt-1">{fmt(item.price)}/yr</p>
      </div>
    </div>
  );
}

export function Browse() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams] = useSearchParams();
  const [propertyType, setPropertyType] = useState(searchParams.get('property_type') || 'all');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [searchTerm, setSearchTerm] = useState('');
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(searchParams.get('location_id') || 'all');
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [compareList, setCompareList] = useState([]);
  const navigate = useNavigate();

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = { status: 'approved' };
      if (propertyType && propertyType !== 'all') params.property_type = propertyType;
      if (locationId && locationId !== 'all') params.location_id = locationId;
      if (priceRange[0] > 0) params.min_price = priceRange[0];
      if (priceRange[1] < 500000) params.max_price = priceRange[1];
      const response = await propertyAPI.getAll(params);
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties(); setRecentlyViewed(getRecentlyViewed()); setFavourites(getFavourites()); setCompareList(getCompareList());
    locationAPI.getAll().then(res => setLocations(res.data)).catch(() => setLocations([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApplyFilters = () => { fetchProperties(); setShowFilters(false); };
  const handleResetFilters = () => { setPropertyType('all'); setLocationId('all'); setPriceRange([0, 500000]); setSearchTerm(''); setShowFavsOnly(false); fetchProperties(); };

  const handleToggleFav = (id) => { toggleFavourite(id); setFavourites(getFavourites()); };

  const filteredProperties = properties.filter(p => {
    if (showFavsOnly && !favourites.includes(p.id)) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.title.toLowerCase().includes(term) || p.location.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term);
  });

  const formatPrice = (price) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);

  return (
    <div className="container mx-auto py-6" data-testid="browse-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Browse Properties</h1>
        <p className="text-foreground/60 mt-1">Find verified hostels and apartments near LAUTECH</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <Input
            placeholder="Search by title, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 bg-white border-border/60"
            data-testid="search-input"
          />
        </div>
        {/* Saved filter button */}
        <Button
          variant={showFavsOnly ? 'default' : 'outline'}
          onClick={() => setShowFavsOnly(!showFavsOnly)}
          className="h-12 gap-2 border-border/60"
          title="Show saved properties"
        >
          <Heart className={`w-4 h-4 ${showFavsOnly ? 'fill-white' : ''}`} />
          <span className="hidden sm:inline">Saved</span>
          {favourites.length > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${showFavsOnly ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>{favourites.length}</span>
          )}
        </Button>
        {/* Compare button */}
        {compareList.length > 0 && (
          <Button
            variant={compareList.length === 2 ? 'default' : 'outline'}
            onClick={() => compareList.length === 2 ? navigate('/compare') : null}
            className="h-12 gap-2 border-border/60"
          >
            <GitCompare className="w-4 h-4" />
            <span className="hidden sm:inline">Compare</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${compareList.length === 2 ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>{compareList.length}/2</span>
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-12 gap-2 border-border/60" data-testid="filter-toggle">
          <SlidersHorizontal className="w-5 h-5" />
          Filters
        </Button>
        <Button variant="ghost" onClick={fetchProperties} className="h-12" data-testid="refresh-btn">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-6 mb-6 animate-fade-in border-border/60 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Filters</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Property Type</label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger data-testid="type-filter"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hostel"><div className="flex items-center gap-2"><Home className="w-4 h-4" />Hostel</div></SelectItem>
                  <SelectItem value="apartment"><div className="flex items-center gap-2"><Building className="w-4 h-4" />Apartment</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Location</label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger data-testid="location-filter"><SelectValue placeholder="All Locations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Price Range (per year)</label>
                <span className="text-sm font-medium text-primary">{formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}</span>
              </div>
              <Slider value={priceRange} onValueChange={setPriceRange} min={0} max={500000} step={10000} className="py-2" data-testid="price-slider" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button onClick={handleApplyFilters} className="flex-1" data-testid="apply-filters">Apply Filters</Button>
            <Button variant="outline" onClick={handleResetFilters} data-testid="reset-filters">Reset</Button>
          </div>
        </Card>
      )}

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && !showFavsOnly && !searchTerm && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              Recently Viewed
            </h2>
            <button onClick={() => { localStorage.removeItem('rentora_recently_viewed'); setRecentlyViewed([]); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {recentlyViewed.map(item => (
              <RecentCard key={item.id} item={item} isFav={favourites.includes(item.id)} onToggleFav={handleToggleFav} />
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-foreground/55 font-medium mb-4">
        {loading ? 'Loading...' : showFavsOnly ? `${filteredProperties.length} saved properties` : `${filteredProperties.length} properties found`}
      </p>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <PropertyCardSkeleton key={i} />)}
        </div>
      ) : filteredProperties.length > 0 ? (
        <div className="results-fade-in grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProperties.map((property, i) => (
            <Fragment key={property.id}>
              <PropertyCard property={property} />
              {(i + 1) % 8 === 0 && i + 1 !== filteredProperties.length && (
                <div className="col-span-full">
                  <AdSlot slot="in_feed_banner" contained />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-border/60">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Search className="w-8 h-8 text-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Properties Found</h3>
          <p className="text-foreground/55 mt-2">Try adjusting your filters or search term</p>
          <Button variant="outline" onClick={handleResetFilters} className="mt-4">Reset Filters</Button>
        </Card>
      )}
    </div>
  );
}

export default Browse;