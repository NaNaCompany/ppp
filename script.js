document.addEventListener('DOMContentLoaded', () => {
    const categoriesNav = document.querySelector('.categories-nav');
    const promptsGrid = document.getElementById('prompts-grid');
    const navLinks = categoriesNav.querySelectorAll('a');

    // Navigation Elements
    const categoriesList = document.getElementById('categories-list');
    const prevBtn = document.getElementById('nav-prev');
    const nextBtn = document.getElementById('nav-next');
    const statValue = document.querySelector('.stat-value');

    // Modal Elements
    const modal = document.getElementById('modal');
    const closeModalBtn = document.getElementById('close-modal');
    const modalCover = document.getElementById('modal-cover');
    const modalTitle = document.getElementById('modal-title');
    const modalAuthor = document.getElementById('modal-author');
    const modalYear = document.getElementById('modal-year');
    const modalPublisher = document.getElementById('modal-publisher');
    const linkKyobo = document.getElementById('link-kyobo');
    const linkYes24 = document.getElementById('link-yes24');
    const linkAladin = document.getElementById('link-aladin');
    const copyToast = document.getElementById('copy-toast');

    // State
    let currentCategory = 'new'; // Default category

    // Initial Load
    fetchTotalPrompts();
    loadPrompts(currentCategory);
    showNonEmptyCategories(); // Check and SHOW valid categories

    // --- Navigation Logic ---
    prevBtn.addEventListener('click', () => {
        categoriesList.scrollBy({ left: -200, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
        categoriesList.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // Drag to Scroll
    let isDown = false;
    let startX;
    let scrollLeft;

    categoriesList.addEventListener('mousedown', (e) => {
        isDown = true;
        categoriesList.classList.add('active'); // Optional: for cursor styling if added
        startX = e.pageX - categoriesList.offsetLeft;
        scrollLeft = categoriesList.scrollLeft;
    });

    categoriesList.addEventListener('mouseleave', () => {
        isDown = false;
    });

    categoriesList.addEventListener('mouseup', () => {
        isDown = false;
    });

    categoriesList.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - categoriesList.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        categoriesList.scrollLeft = scrollLeft - walk;
    });

    // Touch support (basic native usually works, but just in case)
    // Categories overflow-x: auto handles swipe naturally.

    // --- Category Click Handling ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Activate Link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Get Category Name & Normalize
            const catName = link.textContent.trim();
            currentCategory = normalizeCategory(catName);

            loadPrompts(currentCategory);
        });
    });

    // Modal Close Handling
    closeModalBtn.addEventListener('click', () => closeModal());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Functions
    function normalizeCategory(name) {
        if (name === 'ALL') return 'all';
        return name.toLowerCase().replace(/\//g, '_').replace(/\s+/g, '_');
    }

    async function fetchTotalPrompts() {
        try {
            const response = await fetch('https://nanalab.kr/ppp/src/prompts/all.json');
            if (response.ok) {
                const data = await response.json();
                statValue.textContent = data.length.toLocaleString();
            } else {
                console.warn('Failed to fetch all.json');
            }
        } catch (error) {
            console.error('Error fetching total prompts:', error);
        }
    }

    async function showNonEmptyCategories() {
        const links = Array.from(categoriesNav.querySelectorAll('a'));
        const validCategories = [];

        // 1. Fetch data for all categories
        const fetchPromises = links.map(async (link) => {
            const catName = link.textContent.trim();
            const category = normalizeCategory(catName);

            // Skip Special Categories (Keep them, but don't sort/hide primarily)
            if (category === 'new' || category === 'all') return;

            try {
                const response = await fetch(`https://nanalab.kr/ppp/src/prompts/${category}.json`);
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        validCategories.push({
                            element: link.parentElement,
                            count: data.length
                        });
                        // Ensure it's visible based on logic, though we will re-append
                        link.parentElement.style.display = 'block';
                    } else {
                        link.parentElement.style.display = 'none';
                    }
                } else {
                    link.parentElement.style.display = 'none';
                }
            } catch (e) {
                console.warn(`Error checking category ${category}:`, e);
                link.parentElement.style.display = 'none';
            }
        });

        await Promise.all(fetchPromises);

        // 2. Sort valid categories by count (Descending)
        validCategories.sort((a, b) => b.count - a.count);

        // 3. Re-append to DOM
        // Keep "New" and "ALL" at the top. 
        // We append sorted items to the end of the list, automatically reordering them.
        const listContainer = document.getElementById('categories-list');
        validCategories.forEach(item => {
            listContainer.appendChild(item.element);
        });
    }

    async function loadPrompts(category) {
        promptsGrid.innerHTML = '<p style="color:white; text-align:center; grid-column: 1/-1;">Loading...</p>';

        try {
            // Logic: 
            // "new" -> fetch all.json, slice first 10
            // "all" -> fetch all.json, shuffle
            // others -> fetch category.json

            let url = `https://nanalab.kr/ppp/src/prompts/${category}.json`;
            if (category === 'new' || category === 'all') {
                url = 'https://nanalab.kr/ppp/src/prompts/all.json';
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load prompts for ${category}`);

            let data = await response.json();

            if (category === 'new') {
                data = data.slice(0, 10);
            } else if (category === 'all') {
                // Fisher-Yates Shuffle
                for (let i = data.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [data[i], data[j]] = [data[j], data[i]];
                }
            }

            renderPrompts(data);
        } catch (error) {
            console.error(error);
            promptsGrid.innerHTML = `<p style="color:#ef4444; text-align:center; grid-column: 1/-1;">No prompts found for this category (${category}).</p>`;
        }
    }

    function renderPrompts(prompts) {
        promptsGrid.innerHTML = '';

        if (!prompts || prompts.length === 0) {
            promptsGrid.innerHTML = '<p style="color:#94a3b8; text-align:center; grid-column: 1/-1;">No prompts available.</p>';
            return;
        }

        prompts.forEach(item => {
            const card = document.createElement('div');
            card.className = 'prompt-card';

            // Extract Metadata safely
            const meta = item.metadata || {};
            const title = meta['Book Title'] || 'Unknown Title';
            const year = meta['Year'] || '';
            const author = meta['Author'] || 'Unknown Author';

            // Format Footer Text: Book_title (year), Author
            const footerText = `${title}${year ? ` (${year})` : ''}, ${author}`;

            card.innerHTML = `
                <div class="prompt-text">${item.prompt}</div>
                <div class="copy-icon-card">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </div>
                <div class="card-footer">${footerText}</div>
            `;

            // Card Click Event -> Open Modal
            card.addEventListener('click', () => {
                openModal(item);
                copyToClipboard(item.prompt);
            });

            promptsGrid.appendChild(card);
        });
    }

    function openModal(item) {
        const meta = item.metadata || {};

        // Populate Modal Fields
        modalTitle.textContent = meta['Book Title'] || '';
        modalAuthor.textContent = meta['Author'] || '';
        modalYear.textContent = meta['Year'] ? `${meta['Year']}` : '';
        modalPublisher.textContent = meta['Publisher'] || '';

        // Cover Image
        const coverFilename = meta['Cover_filename'];
        if (coverFilename) {
            modalCover.src = `src/bookcovers/${coverFilename}`;
            modalCover.style.display = 'block';
        } else {
            modalCover.style.display = 'none';
        }

        // Store Links - Hide if empty
        // Ensure accurate property names matching Excel headers/JSON keys
        // Python script converts as is. Previous JSON showed keys like "Kyobo", "Yes24", "Aladin".
        updateStoreLink(linkKyobo, meta['Kyobo']);
        updateStoreLink(linkYes24, meta['Yes24']);
        updateStoreLink(linkAladin, meta['Aladin']);

        // Show Toast Animation
        showToast();

        // Show Modal
        modal.classList.remove('hidden');
        // Small delay to allow display:flex to apply before opacity transition
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    function updateStoreLink(element, url) {
        if (url) {
            element.href = url;
            element.style.display = 'flex';
        } else {
            element.style.display = 'none';
        }
    }

    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.add('hidden');
            // Reset toast state when modal closes
            copyToast.classList.remove('active');
        }, 300); // Match transition duration
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            // Already handled by toast in openModal, but good practice
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }

    function showToast() {
        // Show immediately and persist with blink
        copyToast.classList.add('active');
    }

    // Initial style for toast to enable transition
    copyToast.style.transition = 'all 0.3s ease';
    copyToast.style.opacity = '0';
    copyToast.style.transform = 'translateY(-10px)';
});
