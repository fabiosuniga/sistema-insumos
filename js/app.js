// Inicializa o Supabase a partir das credenciais no config.js
const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

let currentUser = null;
let currentRole = null;

// ==========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================
async function init() {
    console.log("Iniciando app...");
    
    // Verifica se há sessão ativa ao carregar a página
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        loadCatalog();
        loadMyRequests();
        if (currentRole === 'gestor') {
            loadDashboard();
            loadEstoque();
        }
        showScreen('screen-catalogo');
    } else {
        showScreen('screen-login');
    }

    // Fica escutando mudanças na autenticação
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await loadUserProfile();
            loadCatalog();
            loadMyRequests();
            if (currentRole === 'gestor') {
                loadDashboard();
                loadEstoque();
            }
            showScreen('screen-catalogo');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentRole = null;
            showScreen('screen-login');
        }
    });
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (error) {
        errorEl.textContent = 'Erro no login: ' + error.message;
        errorEl.style.display = 'block';
    }
}

async function handleSignUp() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';
    
    if(!email || !pass) {
        errorEl.textContent = 'Preencha email e senha para criar conta';
        errorEl.style.display = 'block';
        return;
    }
    
    // Nome provisório baseado no email
    const fullName = email.split('@')[0];
    
    const { data, error } = await supabaseClient.auth.signUp({
        email, 
        password: pass,
        options: {
            data: { full_name: fullName }
        }
    });
    
    if (error) {
        errorEl.textContent = 'Erro ao criar conta: ' + error.message;
        errorEl.style.display = 'block';
    } else {
        alert('Conta criada! Bem-vindo.');
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
}

// ==========================================
// PERFIL E NAVEGAÇÃO
// ==========================================
async function loadUserProfile() {
    if (!currentUser) return;
    
    // Espera rápida caso a trigger de criação de profile esteja rodando (signup)
    await new Promise(r => setTimeout(r, 500));

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('role, full_name')
        .eq('id', currentUser.id)
        .single();
    
    if (data) {
        currentRole = data.role;
        document.querySelector('.user-name').textContent = data.full_name;
        document.querySelector('.user-role').textContent = data.role === 'gestor' ? 'Gestor de TI' : 'Colaborador';
        
        // Controle de RBAC na interface
        const navDashboard = document.getElementById('nav-dashboard');
        const navEstoque = document.getElementById('nav-estoque');
        
        if (currentRole !== 'gestor') {
            if(navDashboard) navDashboard.style.display = 'none';
            if(navEstoque) navEstoque.style.display = 'none';
        } else {
            if(navDashboard) navDashboard.style.display = 'flex';
            if(navEstoque) navEstoque.style.display = 'flex';
        }
    }
}

function showScreen(screenId) {
    const screens = document.querySelectorAll('.app-screen');
    screens.forEach(s => s.style.display = 'none');

    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'block';
    }

    // Atualiza os dados da tela correspondente sempre que o usuário navegar para ela
    if (currentUser) {
        if (screenId === 'screen-catalogo') loadCatalog();
        else if (screenId === 'screen-pedidos') loadMyRequests();
        else if (screenId === 'screen-dashboard' && currentRole === 'gestor') loadDashboard();
        else if (screenId === 'screen-estoque' && currentRole === 'gestor') loadEstoque();
    }

    // Tabs e Nav active states
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + screenId.replace('screen-', ''));
    if (activeTab) activeTab.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeNav = document.getElementById('nav-' + screenId.replace('screen-', ''));
    if (activeNav) activeNav.classList.add('active');
    
    // Oculta sidebar se for tela de login
    const sidebar = document.querySelector('.sidebar');
    if(screenId === 'screen-login') {
        if(sidebar) sidebar.style.display = 'none';
    } else {
        if(sidebar) sidebar.style.display = 'flex';
    }
}

// ==========================================
// CATÁLOGO E PEDIDOS
// ==========================================
async function loadCatalog() {
    const { data: items, error } = await supabaseClient
        .from('items')
        .select('*')
        .eq('is_active', true)
        .order('name');
        
    if (error) {
        console.error("Erro ao carregar catálogo", error);
        return;
    }

    const grid = document.querySelector('.catalog-grid');
    grid.innerHTML = ''; // Limpa os mocks

    items.forEach(item => {
        const isOutOfStock = item.stock <= 0;
        const isLowStock = item.stock > 0 && item.stock <= item.min_stock;
        
        let stockBadge = `<span class="stock-dot"></span> Disponível`;
        if (isOutOfStock) stockBadge = `<span class="stock-dot" style="background-color: var(--color-danger)"></span> Sem Estoque`;
        else if (isLowStock) stockBadge = `<span class="stock-dot warning"></span> Baixo Estoque`;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <div class="product-card-top">
            <span class="product-category">${item.category}</span>
            <div class="stock-badge">
              ${stockBadge}
            </div>
          </div>
          <div class="product-icon-container">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect></svg>
          </div>
          <h3 class="product-title">${item.name}</h3>
          <p class="product-specs">Unidade de medida: ${item.unit}</p>
          <div class="product-footer">
            <span class="product-qty-avail">Qtd: <strong>${item.stock} disp.</strong></span>
            <div style="display: flex; gap: 8px;">
                <input type="number" id="qty-${item.id}" value="1" min="1" max="${item.stock}" class="qty-input" ${isOutOfStock ? 'disabled' : ''}>
                <button class="btn btn-primary btn-sm" 
                  onclick="requestItem('${item.id}', this)" 
                  ${isOutOfStock ? 'disabled style="opacity: 0.5;"' : ''}>
                  ${isOutOfStock ? 'Indisponível' : 'Solicitar'}
                </button>
            </div>
          </div>
        `;
        grid.appendChild(card);
    });
}

async function requestItem(itemId, btnEl) {
    if (!currentUser) return;
    
    const qtyInput = document.getElementById(`qty-${itemId}`);
    const qty = qtyInput ? parseInt(qtyInput.value) : 1;
    
    // Feedback visual
    const originalText = btnEl.textContent;
    btnEl.textContent = 'Aguarde...';
    btnEl.disabled = true;
    
    const { data, error } = await supabaseClient
        .from('requests')
        .insert([
            { user_id: currentUser.id, item_id: itemId, quantity: qty, status: 'pendente' }
        ]);

    if (error) {
        // Trata a RN-01 (Duplicidade) mapeando o erro
        if (error.code === '23505') {
            btnEl.textContent = 'Já Solicitado';
            btnEl.style.backgroundColor = 'var(--status-pending-text)';
            btnEl.style.borderColor = 'var(--status-pending-text)';
        } else {
            alert('Erro ao solicitar: ' + error.message);
            btnEl.textContent = originalText;
            btnEl.disabled = false;
        }
    } else {
        btnEl.textContent = 'Sucesso! ✓';
        btnEl.style.backgroundColor = 'var(--secondary)';
        btnEl.style.borderColor = 'var(--secondary)';
        loadMyRequests(); // Recarrega a lista de pedidos silenciosamente
        
        // Retorna ao estado original após 2s caso queira pedir outro igual depois (embora a RN-01 bloqueie se ainda pendente)
        setTimeout(() => {
            btnEl.textContent = originalText;
            btnEl.disabled = false;
            btnEl.style.backgroundColor = '';
            btnEl.style.borderColor = '';
        }, 2500);
    }
}

async function loadMyRequests() {
    if (!currentUser) return;

    const { data: requests, error } = await supabaseClient
        .from('requests')
        .select(`
            *,
            items ( name )
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar pedidos", error);
        return;
    }

    const tbody = document.querySelector('#screen-pedidos tbody');
    tbody.innerHTML = '';

    requests.forEach(req => {
        let badgeClass = 'badge-pending';
        let badgeText = 'Pendente';
        if (req.status === 'entregue') { badgeClass = 'badge-delivered'; badgeText = 'Entregue'; }
        else if (req.status === 'cancelado') { badgeClass = 'badge-danger'; badgeText = 'Cancelado'; }
        else if (req.status === 'aprovado') { badgeClass = 'badge-delivered'; badgeText = 'Aprovado'; } // reaproveitando cor

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="item-cell">
              <div class="item-icon-box"><svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2"></rect></svg></div>
              <div><span class="item-name">${req.items.name}</span></div>
            </div>
          </td>
          <td><strong>${req.quantity} un.</strong></td>
          <td>${new Date(req.created_at).toLocaleDateString('pt-BR')}</td>
          <td>
            <span class="badge ${badgeClass}">
              <span class="badge-dot"></span>
              ${badgeText}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// DASHBOARD E ESTOQUE (GESTOR)
// ==========================================
async function loadDashboard() {
    if (currentRole !== 'gestor') return;

    // Busca requisições pendentes
    const { data: pendingReqs } = await supabaseClient
        .from('requests')
        .select(`id, created_at, quantity, status, items(name), profiles(full_name, role)`)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });

    if (pendingReqs) {
        document.querySelector('.kpi-card.pending .kpi-value').textContent = pendingReqs.length;
        
        const tbody = document.querySelector('#screen-dashboard tbody');
        tbody.innerHTML = '';
        
        pendingReqs.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>
                <strong>${req.profiles.full_name}</strong><br>
                <span class="item-sub">${req.profiles.role}</span>
              </td>
              <td>${req.items.name} (${req.quantity} un.)</td>
              <td>-</td>
              <td>${new Date(req.created_at).toLocaleDateString('pt-BR')}</td>
              <td>
                <span class="badge badge-pending">
                  <span class="badge-dot"></span>
                  Pendente
                </span>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-secondary-neon btn-sm" onclick="approveRequest('${req.id}', this)">
                  Aprovar
                </button>
                <button class="btn btn-danger-neon btn-sm" style="margin-left: 8px;" onclick="rejectRequest('${req.id}', this)">
                  Recusar
                </button>
              </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function approveRequest(requestId, btnEl) {
    if (btnEl) {
        btnEl.textContent = 'Aprovando...';
        btnEl.disabled = true;
    }

    // Altera o status para 'entregue' (a trigger no BD vai descontar o estoque automaticamente)
    const { error } = await supabaseClient
        .from('requests')
        .update({ status: 'entregue' })
        .eq('id', requestId);

    if (error) {
        alert("Erro ao aprovar: " + error.message);
        if (btnEl) {
            btnEl.textContent = 'Aprovar';
            btnEl.disabled = false;
        }
    } else {
        if (btnEl) {
            btnEl.textContent = 'Aprovado ✓';
            btnEl.style.backgroundColor = 'var(--secondary)';
            btnEl.style.color = '#000';
        }
        // Recarrega silenciosamente em background para remover da lista em 1.5s
        setTimeout(() => {
            loadDashboard(); 
            loadCatalog();   
        }, 1500);
    }
}

async function rejectRequest(requestId, btnEl) {
    if (btnEl) {
        btnEl.textContent = 'Recusando...';
        btnEl.disabled = true;
    }

    const { error } = await supabaseClient
        .from('requests')
        .update({ status: 'cancelado' })
        .eq('id', requestId);

    if (error) {
        alert("Erro ao recusar: " + error.message);
        if (btnEl) {
            btnEl.textContent = 'Recusar';
            btnEl.disabled = false;
        }
    } else {
        if (btnEl) {
            btnEl.textContent = 'Recusado';
        }
        setTimeout(() => {
            loadDashboard(); 
        }, 1500);
    }
}

async function loadEstoque() {
    if (currentRole !== 'gestor') return;
    const { data: items, error } = await supabaseClient.from('items').select('*').order('name');
    if (!items) return;

    const tbody = document.querySelector('#estoque-table tbody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name}</td>
            <td>${item.category}</td>
            <td>
                <strong>${item.stock}</strong>
                <div style="display:inline-flex; gap: 5px; margin-left: 15px;">
                    <input type="number" id="add-stock-${item.id}" value="1" min="1" class="qty-input">
                    <button class="btn btn-outline btn-sm" onclick="addStock('${item.id}', ${item.stock}, this)">+ Adicionar</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function createNewItem(btnEl) {
    const name = document.getElementById('new-item-name').value;
    const category = document.getElementById('new-item-category').value;
    const stock = document.getElementById('new-item-stock').value;
    
    if(!name || !stock) return alert('Preencha nome e estoque inicial');
    
    btnEl.disabled = true;
    const { error } = await supabaseClient.from('items').insert([{
        name, 
        category, 
        stock: parseInt(stock), 
        min_stock: 5, 
        unit: 'un', 
        is_active: true
    }]);
    
    btnEl.disabled = false;
    if(error) {
        alert('Erro ao cadastrar: ' + error.message);
    } else {
        document.getElementById('new-item-name').value = '';
        document.getElementById('new-item-stock').value = '';
        loadEstoque();
        loadCatalog();
    }
}

async function addStock(itemId, currentStock, btnEl) {
    const qtyInput = document.getElementById(`add-stock-${itemId}`);
    const qty = parseInt(qtyInput.value);
    if(!qty || qty <= 0) return;
    
    btnEl.disabled = true;
    const newStock = currentStock + qty;
    
    const { error } = await supabaseClient.from('items').update({ stock: newStock }).eq('id', itemId);
    
    btnEl.disabled = false;
    if(error) {
        alert('Erro ao adicionar estoque: ' + error.message);
    } else {
        qtyInput.value = '1';
        loadEstoque();
        loadCatalog();
    }
}

// Inicializa a aplicação ao carregar a janela
window.addEventListener('DOMContentLoaded', init);
