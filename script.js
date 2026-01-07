document.addEventListener('DOMContentLoaded', () => {
    const categoriesNav = document.querySelector('.categories-nav');
    const promptsGrid = document.getElementById('prompts-grid');
    const navLinks = categoriesNav.querySelectorAll('a');

    // Navigation Elements
    const categoriesList = document.getElementById('categories-list');
    const prevBtn = document.getElementById('nav-prev');
    const nextBtn = document.getElementById('nav-next');
    const statValue = document.querySelector('.stat-value');

    // Hamburger Menu Logic
    const menuToggle = document.querySelector('.menu-toggle');
    const mainNav = document.querySelector('.main-nav');

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });

        // Close menu when a link is clicked
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('active');
            });
        });
    }

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

            // Screenshot HTML
            let screenshotHtml = '';
            if (item.screenshot && item.screenshot.trim() !== '') {
                screenshotHtml = `<img src="https://nanalab.kr/ppp/src/screenshots/${item.screenshot}" loading="lazy" alt="Screenshot" class="card-screenshot">`;
            }

            let promptContent = item.prompt;
            // Add hashtags for 'new' and 'all' categories
            if (currentCategory === 'new' || currentCategory === 'all') {
                let cats = item.category;
                if (typeof cats === 'string') {
                    // Handle legacy comma-separated string if exists, though update_data.py handles it now
                    cats = cats.split(',').map(c => c.trim());
                } else if (!Array.isArray(cats)) {
                    cats = [];
                }

                if (cats.length > 0) {
                    const hashTags = cats.map(c => `<span class="hashtag" data-category="${c}">#${c}</span>`).join(' ');
                    promptContent += `<br><br><span style="color:#94a3b8; font-size:0.9em;">${hashTags}</span>`;
                }
            }

            card.innerHTML = `
            ${screenshotHtml}
                <div class="prompt-text">${promptContent}</div>
                <div class="copy-icon-card">
                    복사하기 <span><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </div>
                ${item.comment ? `<div class="card-comment">${item.comment}</div>` : ''}
                <div class="card-footer">${footerText}</div>
            `;

            // Card Click Event -> Open Modal
            card.addEventListener('click', (e) => {
                // If clicked on hashtag, treat as navigation, NOT card click
                if (e.target.classList.contains('hashtag')) {
                    e.stopPropagation(); // prevent card click
                    const rawCat = e.target.getAttribute('data-category');
                    const targetCat = normalizeCategory(rawCat);

                    // Find Nav Link
                    const targetLink = Array.from(navLinks).find(link =>
                        normalizeCategory(link.textContent.trim()) === targetCat
                    );

                    if (targetLink) {
                        targetLink.click();
                        // Optional: Scroll to top of categories or grid?
                        // targetLink.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                    } else {
                        console.warn(`Category link not found for: ${rawCat}`);
                    }
                    return;
                }

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
    // --- Contact View Logic ---
    const contactLink = document.getElementById('contact-link');
    const homeLink = document.getElementById('home-link');

    // View Containers
    const contactSection = document.getElementById('contact-section');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const contactForm = document.getElementById('contact-form');

    // EmailJS Configuration
    const EMAILJS_SERVICE_ID = 'service_nicpl0u';
    const EMAILJS_TEMPLATE_ID = 'template_h4ve5sp';
    const EMAILJS_PUBLIC_KEY = '61GtFyVFJ4xDftkIG';

    // Init EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    // Toggle View Function
    function showContactView() {
        if (mainContentWrapper && contactSection) {
            mainContentWrapper.style.display = 'none';
            contactSection.style.display = 'flex';
            window.scrollTo(0, 0);
        }
    }

    function showHomeView() {
        if (mainContentWrapper && contactSection) {
            contactSection.style.display = 'none';
            mainContentWrapper.style.display = 'block';
            window.scrollTo(0, 0);
        }
    }

    // Event Listeners
    if (contactLink) {
        contactLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset active state on nav
            document.querySelectorAll('.main-nav a').forEach(el => el.classList.remove('active'));
            contactLink.classList.add('active');
            showContactView();
        });
    }

    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset active state on nav
            document.querySelectorAll('.main-nav a').forEach(el => el.classList.remove('active'));
            homeLink.classList.add('active');
            showHomeView();
        });
    }

    // Contact Form Submit
    if (contactForm) {
        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const btn = contactForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = '전송 중...';
            btn.disabled = true;

            emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, this)
                .then(() => {
                    alert('문의가 성공적으로 전송되었습니다!');
                    contactForm.reset();
                    // Reset reveal states
                    document.querySelectorAll('.form-reveal').forEach(el => el.classList.remove('active'));
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, (error) => {
                    console.error('FAILED...', error);
                    alert('메일 전송에 실패했습니다: ' + JSON.stringify(error));
                    btn.textContent = originalText;
                    btn.disabled = false;
                });
        });
    }

    // Progressive Reveal & Phone Logic
    const nameInput = document.getElementById('mail_name');
    const instInput = document.getElementById('mail_institution');
    const phoneInput = document.getElementById('mail_phone');
    const divInst = document.getElementById('div-institution');
    const divPhone = document.getElementById('div-phone');
    const divEmail = document.getElementById('div-email');

    function handleReveal(input, targetDiv, nextOverflowDiv = null) {
        if (input.value.trim().length > 0) {
            targetDiv.classList.add('active');
            if (nextOverflowDiv) {
                setTimeout(() => {
                    nextOverflowDiv.classList.add('overflow-visible');
                }, 500);
            }
        }
    }

    if (nameInput) nameInput.addEventListener('input', () => handleReveal(nameInput, divInst));
    if (instInput) instInput.addEventListener('input', () => handleReveal(instInput, divPhone, divPhone));

    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            if (divEmail) handleReveal(phoneInput, divEmail);
            const target = e.target;
            let number = target.value.replace(/[^0-9]/g, '');
            let formatted = '';
            if (number.length < 4) {
                formatted = number;
            } else if (number.length < 8) {
                formatted = number.slice(0, -4) + '-' + number.slice(-4);
                if (number.slice(0, -4) === '') formatted = number.slice(-4);
            } else {
                const last4 = number.slice(-4);
                const mid4 = number.slice(-8, -4);
                const prefix = number.slice(0, -8);
                formatted = (prefix ? prefix + '-' : '') + mid4 + '-' + last4;
            }
            if (target.value !== formatted) target.value = formatted;
        });
    }

    // Custom Dropdown Logic
    const selectedDiv = document.querySelector(".select-selected");
    const itemsDiv = document.querySelector(".select-items");
    const hiddenInput = document.getElementById("country_code");

    if (selectedDiv && itemsDiv && hiddenInput) {
        const options = itemsDiv.getElementsByTagName("div");

        selectedDiv.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllSelect(this);
            this.nextElementSibling.classList.toggle("select-hide");
            this.classList.toggle("select-arrow-active");
        });

        for (let i = 0; i < options.length; i++) {
            options[i].addEventListener("click", function (e) {
                e.stopPropagation();
                const value = this.getAttribute("data-value");
                const text = this.innerText;
                selectedDiv.innerHTML = text;
                hiddenInput.value = value;
                selectedDiv.classList.add("active");
                const siblings = this.parentNode.children;
                for (let k = 0; k < siblings.length; k++) {
                    siblings[k].classList.remove("same-as-selected");
                }
                this.classList.add("same-as-selected");
                itemsDiv.classList.add("select-hide");
                selectedDiv.classList.remove("select-arrow-active");
            });
        }
    }

    function closeAllSelect(elmnt) {
        if (elmnt == selectedDiv) return;
        if (itemsDiv) itemsDiv.classList.add("select-hide");
        if (selectedDiv) selectedDiv.classList.remove("select-arrow-active");
    }
    document.addEventListener("click", closeAllSelect);

});
