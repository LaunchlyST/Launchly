import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEditorStore } from '../editor-state/editorStore';
import { UploadIcon, VideoIcon, ImageIcon } from '../icons/Icon';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  status: 'draft' | 'published';
  fileName: string;
  fileSize: string;
  sales: number;
  thumbnail: string;
}

export function UploadPage() {
  const { addToast, uploadSubPage, setUploadSubPage } = useEditorStore() as any;
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productStatus, setProductStatus] = useState<'draft' | 'published'>('draft');
  const [products, setProducts] = useState<Product[]>([]);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const processFile = (file: File) => {
    setUploadedFile(file);
    setIsUploading(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        const next = prev + Math.random() * 15 + 5;
        if (next >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadProgress(100);
          addToast(`"${file.name}" uploaded successfully`, { type: 'success' });
          return 100;
        }
        return next;
      });
    }, 200);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleAddProduct = () => {
    if (!uploadedFile || !productName.trim()) {
      addToast('Please upload a file and add a product name', { type: 'warning' });
      return;
    }
    const product: Product = {
      id: `prod-${Date.now()}`,
      name: productName.trim(),
      description: productDesc.trim(),
      price: productPrice || '0.00',
      category: productCategory || 'Other',
      status: productStatus,
      fileName: uploadedFile.name,
      fileSize: formatFileSize(uploadedFile.size),
      sales: Math.floor(Math.random() * 200),
      thumbnail: '',
    };
    setProducts((prev) => [product, ...prev]);
    setProductName('');
    setProductDesc('');
    setProductPrice('');
    setProductCategory('');
    setProductStatus('draft');
    setShowCoverUpload(false);
    addToast(`"${product.name}" saved as ${productStatus === 'draft' ? 'draft' : 'published'}`, { type: 'success' });
  };

  const handlePublish = () => {
    handleAddProduct();
    setUploadSubPage('selling');
  };

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    addToast('Product removed', { type: 'info' });
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('video/')) return <VideoIcon size={24} />;
    if (type.startsWith('image/')) return <ImageIcon size={24} />;
    return <UploadIcon size={24} />;
  };

  return (
    <div className="upload-page">
      {/* Header */}
      <div className="upload-page__header">
        <div className="upload-page__title-group">
          <h1 className="upload-page__title">Upload your project</h1>
          <p className="upload-page__subtitle">Upload your digital product and get it ready to sell.</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="upload-page__tabbar">
        <button
          className={`upload-page__tab ${uploadSubPage === 'upload-project' ? 'is-active' : ''}`}
          onClick={() => setUploadSubPage('upload-project')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Project
        </button>
        <button
          className={`upload-page__tab ${uploadSubPage === 'selling' ? 'is-active' : ''}`}
          onClick={() => setUploadSubPage('selling')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Selling
        </button>
      </div>

      {/* Content */}
      {uploadSubPage === 'upload-project' && (
        <div className="upload-page__content">
          {/* Drop Zone */}
          {!uploadedFile ? (
            <div
              className={`upload-page__dropzone ${dragOver ? 'is-dragover' : ''} ${isUploading ? 'is-uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="*/*"
                onChange={handleFileSelect}
              />
              <div className="upload-page__drop-icon">
                <UploadIcon size={48} />
              </div>
              <p className="upload-page__drop-title">
                {isUploading ? 'Uploading...' : 'Drop your project here'}
              </p>
              <p className="upload-page__drop-hint">or click to browse</p>
              <div className="upload-page__drop-formats">MP4, MOV, AVI, PNG, JPG, GIF, MP3, WAV</div>
              {isUploading && (
                <div className="upload-page__progress">
                  <div className="upload-page__progress-bar">
                    <div className="upload-page__progress-fill" style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
                  </div>
                  <span className="upload-page__progress-text">{Math.round(Math.min(uploadProgress, 100))}%</span>
                </div>
              )}
            </div>
          ) : (
            /* Uploaded File Card */
            <div className="upload-page__filecard">
              <div className="upload-page__filecard-thumb">
                {getFileIcon(uploadedFile)}
              </div>
              <div className="upload-page__filecard-info">
                <span className="upload-page__filecard-name">{uploadedFile.name}</span>
                <span className="upload-page__filecard-size">{formatFileSize(uploadedFile.size)}</span>
              </div>
              {uploadProgress < 100 ? (
                <div className="upload-page__filecard-status">
                  <div className="upload-page__progress">
                    <div className="upload-page__progress-bar">
                      <div className="upload-page__progress-fill" style={{ width: `${Math.min(uploadProgress, 100)}%` }} />
                    </div>
                    <span className="upload-page__progress-text">{Math.round(Math.min(uploadProgress, 100))}%</span>
                  </div>
                </div>
              ) : (
                <span className="upload-page__filecard-status upload-page__filecard-status--done">✓ Uploaded</span>
              )}
              <button className="upload-page__filecard-remove" onClick={handleRemoveFile} title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          )}

          {/* Product Details */}
          {uploadedFile && (
            <div className="upload-page__details">
              <h2 className="upload-page__details-title">Product details</h2>
              <div className="upload-page__form">
                <div className="upload-page__field">
                  <label className="upload-page__label">Product name</label>
                  <input
                    className="upload-page__input"
                    type="text"
                    placeholder="e.g. My Amazing Video Course"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div className="upload-page__field">
                  <label className="upload-page__label">Short description</label>
                  <textarea
                    className="upload-page__input upload-page__textarea"
                    placeholder="Describe what your product offers..."
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="upload-page__row">
                  <div className="upload-page__field">
                    <label className="upload-page__label">Price (£)</label>
                    <input
                      className="upload-page__input"
                      type="number"
                      placeholder="0.00"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="upload-page__field">
                    <label className="upload-page__label">Category</label>
                    <select
                      className="upload-page__input upload-page__select"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                    >
                      <option value="">Select...</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="design">Design</option>
                      <option value="template">Template</option>
                      <option value="course">Course</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Cover image upload */}
                <div className="upload-page__field">
                  <label className="upload-page__label">Cover image</label>
                  <div
                    className={`upload-page__cover ${showCoverUpload ? 'has-file' : ''}`}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <input
                      ref={coverInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={() => setShowCoverUpload(true)}
                    />
                    {showCoverUpload ? (
                      <span className="upload-page__cover-check">✓ Cover set</span>
                    ) : (
                      <span className="upload-page__cover-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21" /></svg>
                        Click to add cover
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="upload-page__field">
                  <label className="upload-page__label">Product status</label>
                  <div className="upload-page__status-group">
                    <button
                      className={`upload-page__status-btn ${productStatus === 'draft' ? 'is-active' : ''}`}
                      onClick={() => setProductStatus('draft')}
                    >
                      Draft
                    </button>
                    <button
                      className={`upload-page__status-btn ${productStatus === 'published' ? 'is-active' : ''}`}
                      onClick={() => setProductStatus('published')}
                    >
                      Published
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="upload-page__actions">
                  <button className="upload-page__btn upload-page__btn--primary" onClick={handlePublish}>
                    Publish Product
                  </button>
                  <button
                    className="upload-page__btn upload-page__btn--secondary"
                    onClick={() => {
                      setProductName('');
                      setProductDesc('');
                      setProductPrice('');
                      setProductCategory('');
                      setProductStatus('draft');
                      setShowCoverUpload(false);
                      addToast('Draft saved', { type: 'success' });
                    }}
                  >
                    Save as draft
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selling Tab */}
      {uploadSubPage === 'selling' && (
        <div className="upload-page__selling">
          <div className="upload-page__selling-header">
            <h2 className="upload-page__selling-title">Your products</h2>
            <span className="upload-page__selling-count">{products.length}</span>
          </div>

          {products.length === 0 ? (
            <div className="upload-page__empty">
              <div className="upload-page__empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <p className="upload-page__empty-text">You haven't published any products yet.</p>
              <button className="upload-page__cta" onClick={() => setUploadSubPage('upload-project')}>
                Upload your first project
              </button>
            </div>
          ) : (
            <div className="upload-page__grid">
              {products.map((product) => (
                <div key={product.id} className="upload-page__card">
                  <div className="upload-page__card-thumb">
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt={product.name} />
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8" /></svg>
                    )}
                    <span className={`upload-page__card-badge ${product.status === 'published' ? 'badge-live' : 'badge-draft'}`}>
                      {product.status === 'published' ? '● Live' : '● Draft'}
                    </span>
                  </div>
                  <div className="upload-page__card-info">
                    <span className="upload-page__card-name">{product.name}</span>
                    <span className="upload-page__card-file">{product.fileName}</span>
                    <span className="upload-page__card-price">£{product.price}</span>
                    {product.sales > 0 && (
                      <span className="upload-page__card-sales">{product.sales} sales</span>
                    )}
                  </div>
                  <div className="upload-page__card-actions">
                    <button className="upload-page__card-btn" title="Edit" onClick={() => addToast('Edit coming soon', { type: 'info' })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="upload-page__card-btn" title="Preview" onClick={() => addToast('Preview coming soon', { type: 'info' })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button className="upload-page__card-btn upload-page__card-btn--danger" title="Delete" onClick={() => handleDeleteProduct(product.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
