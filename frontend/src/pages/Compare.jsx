import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, X, Home, Building, MapPin, Coins, GitCompare, Plus } from 'lucide-react';

function getCompareList() {
  try { return JSON.parse(localStorage.getItem('rentora_compare') || '[]'); }
  catch { return []; }
}
function removeFromCompare(id) {
  const list = getCompareList().filter(p => p.id !== id);
  localStorage.setItem('rentora_compare', JSON.stringify(list));
}
function clearCompare() {
  localStorage.setItem('rentora_compare', '[]');
}

export function Compare() {
  const navigate = useNavigate();
  const [compareList, setCompareList] = useState([]);

  useEffect(() => {
    setCompareList(getCompareList());
  }, []);

  const handleRemove = (id) => {
    removeFromCompare(id);
    setCompareList(getCompareList());
  };

  const handleClear = () => {
    clearCompare();
    setCompareList([]);
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(price);

  const rows = [
    { label: 'Type', key: 'property_type', render: (v) => <span className="capitalize">{v}</span> },
    { label: 'Location', key: 'location' },
    { label: 'Annual Rent', key: 'price', render: (v) => <span className="font-bold text-primary">{formatPrice(v)}</span> },
  ];

  return (
    <div className="container mx-auto px-4 py-6" data-testid="compare-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/browse')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Browse
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GitCompare className="w-6 h-6 text-primary" />
              Compare Properties
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Side by side comparison</p>
          </div>
        </div>
        {compareList.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5">
            <X className="w-4 h-4" />
            Clear All
          </Button>
        )}
      </div>

      {compareList.length === 0 ? (
        /* Empty state */
        <Card className="p-16 text-center border-border/60">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <GitCompare className="w-10 h-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold">No Properties to Compare</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            Browse properties and tap <strong>Compare</strong> on up to 2 properties to see them side by side.
          </p>
          <Button onClick={() => navigate('/browse')} className="mt-6 gap-2">
            <Plus className="w-4 h-4" />
            Browse Properties
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Property cards side by side */}
          <div className={`grid gap-4 ${compareList.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-sm'}`}>
            {compareList.map((item) => {
              const TypeIcon = item.property_type === 'hostel' ? Home : Building;
              return (
                <Card key={item.id} className="overflow-hidden border-border/60">
                  {/* Image */}
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    <img
                      src={item.image || 'https://images.pexels.com/photos/3754595/pexels-photo-3754595.jpeg'}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-3 left-3 gap-1 text-xs">
                      <TypeIcon className="w-3 h-3" />
                      {item.property_type}
                    </Badge>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-sm line-clamp-2 leading-snug">{item.title}</h3>
                    <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs line-clamp-1">{item.location}</span>
                    </div>
                    <p className="text-primary font-black text-lg mt-2">
                      {formatPrice(item.price)}
                      <span className="text-xs text-muted-foreground font-normal">/yr</span>
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => navigate(`/property/${item.id}`)}
                    >
                      View Property
                    </Button>
                  </div>
                </Card>
              );
            })}

            {/* Add second slot if only 1 */}
            {compareList.length === 1 && (
              <Card
                className="border-2 border-dashed border-border/40 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center p-8 text-center"
                onClick={() => navigate('/browse')}
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm text-muted-foreground">Add a second property</p>
                <p className="text-xs text-muted-foreground mt-1">Browse and tap Compare on any property</p>
              </Card>
            )}
          </div>

          {/* Comparison table */}
          {compareList.length === 2 && (
            <Card className="overflow-hidden border-border/60">
              <div className="bg-muted/40 px-4 py-3 border-b border-border/60">
                <h2 className="font-semibold text-sm">Side by Side Comparison</h2>
              </div>
              <div className="divide-y divide-border/40">
                {rows.map(row => (
                  <div key={row.key} className="grid grid-cols-3 divide-x divide-border/40">
                    {/* Label */}
                    <div className="px-4 py-3 bg-muted/20 flex items-center">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{row.label}</span>
                    </div>
                    {/* Values */}
                    {compareList.map(item => (
                      <div key={item.id} className="px-4 py-3 flex items-center">
                        <span className="text-sm">
                          {row.render ? row.render(item[row.key]) : (item[row.key] || '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default Compare;
