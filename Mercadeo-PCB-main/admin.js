// Verificar autenticación
if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
  window.location.href = 'index.html';
}

let products = [];
let pendingImageFile = null; // archivo seleccionado pendiente de subir

// =====================================================
// MANEJO DE IMAGEN
// =====================================================

function handleImageFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('⚠️ La imagen no puede superar 2 MB', 'error');
    input.value = '';
    return;
  }
  pendingImageFile = file;
  document.getElementById('product-image-url').value = '';
  const reader = new FileReader();
  reader.onload = e => showImagePreview(e.target.result);
  reader.readAsDataURL(file);
}

function handleImageUrl(url) {
  pendingImageFile = null;
  document.getElementById('product-image-file').value = '';
  if (url) showImagePreview(url);
  else hideImagePreview();
}

function showImagePreview(src) {
  const container = document.getElementById('image-preview-container');
  const img = document.getElementById('image-preview');
  img.src = src;
  container.classList.remove('hidden');
}

function hideImagePreview() {
  document.getElementById('image-preview-container').classList.add('hidden');
  document.getElementById('image-preview').src = '';
}

function clearImage() {
  pendingImageFile = null;
  document.getElementById('product-image-file').value = '';
  document.getElementById('product-image-url').value = '';
  hideImagePreview();
}

async function resolveImageUrl() {
  // Si hay archivo, subirlo a Supabase Storage
  if (pendingImageFile && typeof DB !== 'undefined' && typeof DB.uploadImage === 'function') {
    try {
      const url = await DB.uploadImage(pendingImageFile);
      if (url) return url;
    } catch (e) {
      console.error('Error subiendo imagen:', e.message);
      showToast('⚠️ No se pudo subir la imagen, guardando sin foto', 'info');
    }
  }
  // Si hay URL manual, usarla
  const urlInput = document.getElementById('product-image-url').value.trim();
  if (urlInput) return urlInput;
  return null;
}

// Cargar productos desde Supabase o localStorage al iniciar
async function loadProducts() {
  if (typeof DB !== 'undefined') {
    try {
      const data = await DB.getProducts();
      if (data && data.length > 0) {
        products = data;
        renderProducts();
        return;
      }
    } catch (e) {
      console.log('Cargando desde localStorage...', e.message);
    }
  }
  const stored = localStorage.getItem('mercadeo_products');
  products = stored ? JSON.parse(stored) : [];
  renderProducts();
}

function updateStats() {
  document.getElementById('total-products').textContent = products.length;
  const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
  document.getElementById('avg-price').textContent = `$${avgPrice.toFixed(2)}`;
}

function getCategoryName(category) {
  const names = {
    'dulces': '🍬 Dulces',
    'chocolates': '🍫 Chocolates',
    'bebidas': '🥤 Bebidas',
    'snacks': '🍿 Snacks'
  };
  return names[category] || category;
}

function renderProducts() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  tbody.innerHTML = products.map(product => `
    <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td class="px-6 py-4">
        ${product.image || product.image_url
          ? `<img src="${product.image || product.image_url}" alt="${product.name}"
               class="w-12 h-12 object-contain rounded-lg bg-white/5 border border-white/10 p-1"
               onerror="this.outerHTML='<span class=\'text-2xl\'>${product.emoji || '🍬'}</span>'">`
          : `<span class="text-2xl">${product.emoji || '🍬'}</span>`}
      </td>
      <td class="px-6 py-4 font-semibold">${product.name}</td>
      <td class="px-6 py-4 text-sm">${getCategoryName(product.category)}</td>
      <td class="px-6 py-4 font-bold text-[#f59e0b]">$${parseFloat(product.price).toFixed(2)}</td>
      <td class="px-6 py-4">
        ${product.popular ? '<span class="text-xs bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-1 rounded-full font-semibold">⭐ Popular</span>' : '-'}
      </td>
      <td class="px-6 py-4">
        <div class="flex gap-2">
          <button onclick="editProduct('${product.id}')"
            class="text-blue-400 hover:text-blue-300 transition-colors p-2 hover:bg-blue-400/10 rounded"
            title="Editar">
            ✏️
          </button>
          <button onclick="deleteProduct('${product.id}')"
            class="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-400/10 rounded"
            title="Eliminar">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  updateStats();
}

function showAddProductModal() {
  document.getElementById('modal-title').textContent = 'Añadir Producto';
  document.getElementById('product-form').reset();
  document.getElementById('product-id').value = '';
  clearImage();
  document.getElementById('product-modal').classList.add('active');
}

function editProduct(id) {
  const product = products.find(p => String(p.id) === String(id));
  if (!product) return;

  document.getElementById('modal-title').textContent = 'Editar Producto';
  document.getElementById('product-id').value = product.id;
  document.getElementById('product-name').value = product.name;
  document.getElementById('product-emoji').value = product.emoji || '';
  document.getElementById('product-price').value = product.price;
  document.getElementById('product-category').value = product.category;
  document.getElementById('product-popular').checked = product.popular;

  // Cargar imagen existente
  clearImage();
  const existingImage = product.image || product.image_url || '';
  if (existingImage) {
    document.getElementById('product-image-url').value = existingImage;
    showImagePreview(existingImage);
  }
  document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

async function deleteProduct(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;

  if (typeof DB !== 'undefined') {
    try { await DB.deleteProduct(id); } catch (e) { console.error('deleteProduct:', e.message); }
  }
  products = products.filter(p => String(p.id) !== String(id));
  localStorage.setItem('mercadeo_products', JSON.stringify(products));
  renderProducts();
  showToast('🗑️ Producto eliminado', 'info');
}

// Form submit
document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('product-id').value;
  const imageUrl = await resolveImageUrl();
  const productData = {
    name: document.getElementById('product-name').value,
    emoji: document.getElementById('product-emoji').value,
    price: parseFloat(document.getElementById('product-price').value),
    category: document.getElementById('product-category').value,
    popular: document.getElementById('product-popular').checked,
    ...(imageUrl && { image: imageUrl, image_url: imageUrl })
  };

  if (id) {
    // Editar producto existente
    const fullProduct = { ...products.find(p => String(p.id) === String(id)), ...productData, id };
    if (typeof DB !== 'undefined') {
      try { await DB.saveProduct(fullProduct); } catch (e) { console.error('saveProduct:', e.message); }
    }
    const index = products.findIndex(p => String(p.id) === String(id));
    if (index !== -1) products[index] = fullProduct;
    showToast('✅ Producto actualizado', 'success');
  } else {
    // Añadir nuevo producto
    let saved = productData;
    if (typeof DB !== 'undefined') {
      try { saved = await DB.saveProduct(productData); } catch (e) { console.error('saveProduct:', e.message); }
    }
    if (!saved.id) saved.id = Date.now();
    products.push(saved);
    showToast('✅ Producto añadido', 'success');
  }

  localStorage.setItem('mercadeo_products', JSON.stringify(products));
  renderProducts();
  closeProductModal();
});

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => loadProducts());

