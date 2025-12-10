import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Upload, Plus, Link as LinkIcon, X, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { productsApi, uploadApi, type CreateProductData, type UploadedImage } from '@/lib/api';

const categories = [
  'General Dentistry',
  'Airotar',
  'Daily Consumables',
  'Root canal Treatment',
  'Restorative',
  'Extraction',
  'Orthodontics',
  'Prosthodontics',
  'Instruments',
  'Sterilization',
  'Clinical Problem Solvers',
  'Medical Supplies',
];

interface ImageItem {
  url: string;
  publicId?: string;
  isUploading?: boolean;
  error?: string;
}

const AddProducts = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    basePrice: '',
    discountedPrice: '',
    chargeTax: false,
    inStock: true,
    status: 'draft',
    category: '',
    stock: '0',
  });

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError(`Invalid file type: ${file.name}. Only JPEG, PNG, GIF, and WebP are allowed.`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`File too large: ${file.name}. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    // Add placeholder images for upload progress
    const placeholders: ImageItem[] = validFiles.map((file) => ({
      url: URL.createObjectURL(file),
      isUploading: true,
    }));
    setImages((prev) => [...prev, ...placeholders]);

    try {
      if (validFiles.length === 1) {
        // Single file upload
        const response = await uploadApi.uploadImage(validFiles[0]);
        if (response.success && response.data) {
          setImages((prev) =>
            prev.map((img) =>
              img.isUploading && img.url === placeholders[0].url
                ? { url: response.data!.url, publicId: response.data!.publicId }
                : img
            )
          );
        } else {
          // Remove failed placeholder
          setImages((prev) => prev.filter((img) => img.url !== placeholders[0].url));
          setError(response.message || 'Failed to upload image');
        }
      } else {
        // Multiple files upload
        const response = await uploadApi.uploadImages(validFiles);
        if (response.success && response.data) {
          const uploadedImages = response.data.images;
          setImages((prev) => {
            // Remove all placeholders and add uploaded images
            const filtered = prev.filter((img) => !img.isUploading);
            return [
              ...filtered,
              ...uploadedImages.map((img: UploadedImage) => ({
                url: img.url,
                publicId: img.publicId,
              })),
            ];
          });
        } else {
          // Remove failed placeholders
          setImages((prev) => prev.filter((img) => !img.isUploading));
          setError(response.message || 'Failed to upload images');
        }
      }
    } catch (err) {
      // Remove all placeholders on error
      setImages((prev) => prev.filter((img) => !img.isUploading));
      setError('An error occurred while uploading images');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      // Clean up object URLs
      placeholders.forEach((p) => URL.revokeObjectURL(p.url));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveImage = async (index: number) => {
    const imageToRemove = images[index];
    
    // If it has a publicId, delete from Cloudinary
    if (imageToRemove.publicId) {
      try {
        await uploadApi.deleteImage(imageToRemove.publicId);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }
    
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const buildProductData = (status: 'draft' | 'active' | 'archived'): CreateProductData => {
    const imageUrls = images.filter((img) => !img.isUploading).map((img) => img.url);
    return {
      name: formData.name,
      description: formData.description || undefined,
      sku: formData.sku || undefined,
      barcode: formData.barcode || undefined,
      basePrice: parseFloat(formData.basePrice) || 0,
      discountedPrice: formData.discountedPrice ? parseFloat(formData.discountedPrice) : undefined,
      chargeTax: formData.chargeTax,
      inStock: formData.inStock,
      stock: parseInt(formData.stock) || 0,
      status,
      category: formData.category,
      image: imageUrls[0] || '',
      images: imageUrls,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProduct('active');
  };

  const saveProduct = async (status: 'draft' | 'active' | 'archived') => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        setError('Product name is required');
        return;
      }
      if (!formData.category) {
        setError('Category is required');
        return;
      }
      if (!formData.basePrice || parseFloat(formData.basePrice) <= 0) {
        setError('Base price must be greater than 0');
        return;
      }

      const productData = buildProductData(status);
      const response = await productsApi.createProduct(productData);

      if (response.success) {
        navigate('/dashboard/products');
      } else {
        setError(response.message || 'Failed to save product');
      }
    } catch (err) {
      setError('An error occurred while saving the product');
      console.error('Save product error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard all changes?')) {
      navigate('/dashboard/products');
    }
  };

  const handleSaveDraft = async () => {
    await saveProduct('draft');
  };

  const handlePublish = async () => {
    await saveProduct('active');
  };

  const handleAddUrlInput = () => {
    setUrlInputs([...urlInputs, '']);
  };

  const handleUrlInputChange = (index: number, value: string) => {
    const newInputs = [...urlInputs];
    newInputs[index] = value;
    setUrlInputs(newInputs);
  };

  const handleRemoveUrlInput = (index: number) => {
    if (urlInputs.length > 1) {
      const newInputs = urlInputs.filter((_, i) => i !== index);
      setUrlInputs(newInputs);
    }
  };

  const handleAddUrls = () => {
    const validUrls = urlInputs.filter((url) => url.trim() !== '');
    if (validUrls.length > 0) {
      setImages((prev) => [...prev, ...validUrls.map((url) => ({ url }))]);
      setUrlInputs(['']);
      setIsUrlDialogOpen(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard/products')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Add Products</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleDiscard} disabled={isSubmitting}>
                Discard
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Draft
              </Button>
              <Button type="submit" onClick={handlePublish} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publish
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter product name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      placeholder="Enter SKU"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      placeholder="Enter barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter product description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-sm text-muted-foreground">
                    Set a description to the product for better visibility.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Product Images Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Product Images</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                    onClick={() => setIsUrlDialogOpen(true)}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Add media from URL
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Uploaded Images Grid */}
                {images.length > 0 && (
                  <div className="space-y-2">
                    <Label>Uploaded Images ({images.length})</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((image, index) => (
                        <div
                          key={index}
                          className="relative group aspect-square border rounded-lg overflow-hidden bg-muted"
                        >
                          {image.isUploading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <>
                              <img
                                src={image.url}
                                alt={`Product image ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EError%3C/text%3E%3C/svg%3E';
                                }}
                              />
                              {index === 0 && (
                                <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                                  Primary
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                                onClick={() => handleRemoveImage(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  <div className="rounded-full bg-muted p-4">
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium">
                      {isUploading ? 'Uploading...' : 'Drop your images here, or click to browse'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, GIF, or WebP (max. 10MB each)
                    </p>
                  </div>
                  {!isUploading && (
                    <Button type="button" variant="outline" size="sm">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Select Images
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Add Media from URL Dialog */}
            <Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Media from URL</DialogTitle>
                  <DialogDescription>
                    Enter image URLs to add them to your product. You can add multiple URLs.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {urlInputs.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`url-${index}`}>Image URL {index + 1}</Label>
                        <Input
                          id={`url-${index}`}
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={url}
                          onChange={(e) => handleUrlInputChange(index, e.target.value)}
                        />
                      </div>
                      {urlInputs.length > 1 && (
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUrlInput(index)}
                            className="mb-2"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddUrlInput}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another URL
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsUrlDialogOpen(false);
                      setUrlInputs(['']);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleAddUrls}>
                    Add URLs
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Pricing Card */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Base Price</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    placeholder="0.00"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountedPrice">Discounted Price</Label>
                  <Input
                    id="discountedPrice"
                    type="number"
                    placeholder="0.00"
                    value={formData.discountedPrice}
                    onChange={(e) => setFormData({ ...formData, discountedPrice: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chargeTax"
                    checked={formData.chargeTax}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, chargeTax: checked as boolean })
                    }
                  />
                  <Label htmlFor="chargeTax" className="font-normal cursor-pointer">
                    Charge tax on this product
                  </Label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="inStock">In stock</Label>
                  </div>
                  <Switch
                    id="inStock"
                    checked={formData.inStock}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, inStock: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Categories Card */}
            <Card>
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger id="category" className="flex-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category.toLowerCase().replace(/\s+/g, '-')}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </form>
  );
};

export default AddProducts;
