/* Generated: edit src/js/portal.js and src/js/contact.js. */
/* Progressive enhancement: every prompt, book and category remains readable without JS. */
document.addEventListener('DOMContentLoaded', () => {
    const dataNode = document.getElementById('page-data');
    if (!dataNode) {
        // Refresh an older cached application shell once after the static-page migration.
        const target = new URL(location.href);
        if (!target.searchParams.has('static')) {
            target.searchParams.set('static', '1');
            location.replace(target.href);
        }
        return;
    }
    const data = JSON.parse(dataNode.textContent);
    const modal = document.getElementById('modal');
    const closeButton = document.getElementById('close-modal');
    const cover = document.getElementById('modal-cover');
    const toast = document.getElementById('copy-toast');
    const previous = document.getElementById('modal-previous');
    const previousList = document.getElementById('modal-previous-list');
    const context = document.getElementById('modal-context');
    let opener;
    let closeTimer;
    let modalVersion = 0;
    const groupCache = new Map();

    const header = document.querySelector('.site-header');
    const announcement = document.querySelector('.announcement-bar');
    const measureSticky = () => {
        document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
        document.documentElement.style.setProperty('--announcement-height', `${announcement.getBoundingClientRect().height}px`);
    };
    const observer = new ResizeObserver(measureSticky);
    observer.observe(header);
    observer.observe(announcement);
    measureSticky();
    document.getElementById('nav-prev').addEventListener('click', () => document.getElementById('categories-list').scrollBy({left:-220,behavior:'smooth'}));
    document.getElementById('nav-next').addEventListener('click', () => document.getElementById('categories-list').scrollBy({left:220,behavior:'smooth'}));
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.main-nav');
    toggle.addEventListener('click', () => {
        const expanded = nav.classList.toggle('active');
        toggle.setAttribute('aria-expanded', String(expanded));
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        nav.classList.remove('active');
        toggle.setAttribute('aria-expanded','false');
    }));

    async function copy(text) {
        toast.classList.remove('error');
        try {
            await navigator.clipboard.writeText(text);
            toast.textContent = '프롬프트가 복사되었습니다!';
        } catch {
            toast.textContent = '자동 복사에 실패했습니다. 본문을 선택해 복사하세요.';
            toast.classList.add('error');
        }
        toast.classList.add('active');
    }

    function storeLink(id, url) {
        const link = document.getElementById(id);
        link.hidden = true;
        link.removeAttribute('href');
        if (!url) return;
        try {
            const target = new URL(url);
            if (target.protocol !== 'https:' && target.protocol !== 'http:') return;
            link.href = target.href;
            link.hidden = false;
        } catch { /* An absent or malformed link never inherits the previous book's address. */ }
    }

    function loadGroup(id) {
        if (!groupCache.has(id)) {
            groupCache.set(id, fetch(data.groups[id]).then(response => {
                if (!response.ok) throw new Error('Could not load prompt sequence');
                return response.json();
            }).catch(error => {
                groupCache.delete(id);
                throw error;
            }));
        }
        return groupCache.get(id);
    }

    function openSource(card) {
        const book = data.books[card.dataset.bookId];
        if (!book) return;
        const version = ++modalVersion;
        clearTimeout(closeTimer);
        opener = document.activeElement;
        toast.classList.remove('active','error');
        toast.textContent = '';
        document.getElementById('modal-title').textContent = book.title;
        document.getElementById('modal-author').textContent = book.author;
        document.getElementById('modal-year').textContent = book.year;
        document.getElementById('modal-publisher').textContent = book.publisher;
        const page = document.getElementById('modal-source-page');
        page.textContent = card.dataset.printedPage ? `본문 ${card.dataset.printedPage}p.` : '';
        page.hidden = !card.dataset.printedPage;
        cover.hidden = !book.cover;
        if (book.cover) {
            cover.src = data.base + 'src/bookcovers/' + encodeURIComponent(book.cover);
            cover.alt = book.title + ' 표지';
        } else cover.removeAttribute('src');
        storeLink('link-kyobo', book.stores.Kyobo);
        storeLink('link-yes24', book.stores.Yes24);
        storeLink('link-aladin', book.stores.Aladin);
        const comment = card.querySelector('.card-comment')?.textContent || '';
        document.getElementById('modal-usage').textContent = comment;
        previous.open = false;
        previous.hidden = true;
        previousList.replaceChildren();
        context.hidden = !comment;
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => {
            modal.classList.add('show');
            closeButton.focus();
        });
        // Start the clipboard write inside the original user gesture, before any network await.
        copy(card.querySelector('[data-copy-text]').textContent);
        loadGroup(card.dataset.groupId).then(group => {
            if (version !== modalVersion || group.records.length < 2) return;
            previous.querySelector('summary').textContent = `프롬프트 순서 (입력 ${group.records.length}개)`;
            group.records.forEach(record => {
                const li = document.createElement('li');
                const text = document.createElement('p');
                text.textContent = record.body;
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = '이 입력 복사';
                button.addEventListener('click', () => copy(record.body));
                li.append(text, button);
                previousList.appendChild(li);
            });
            previous.hidden = false;
            context.hidden = false;
        }).catch(() => { /* Static detail pages still contain the complete sequence. */ });
    }

    function closeModal() {
        ++modalVersion;
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        closeTimer = setTimeout(() => {
            modal.classList.add('hidden');
            if (opener?.isConnected) opener.focus();
        }, 300);
    }
    document.querySelectorAll('[data-open-source]').forEach(button => { button.hidden = false; });
    document.addEventListener('click', event => {
        const card = event.target.closest('.prompt-card');
        if (card && !event.target.closest('a')) openSource(card);
    });
    document.addEventListener('keydown', event => {
        if (!modal.classList.contains('hidden')) {
            if (event.key === 'Escape') closeModal();
            if (event.key === 'Tab') {
                const items = [...modal.querySelectorAll('button,a[href],summary')].filter(el => el.getClientRects().length);
                const first = items[0], last = items[items.length-1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault();last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault();first.focus(); }
            }
        } else if (event.target.matches('.prompt-card') && ['Enter',' '].includes(event.key)) {
            event.preventDefault();
            openSource(event.target);
        }
    });
    closeButton.addEventListener('click',closeModal);
    modal.addEventListener('click',event => { if (event.target === modal) closeModal(); });

    const results = document.getElementById('search-results');
    if (results) {
        const form = document.querySelector('.search-form');
        const input = document.getElementById('portal-search');
        const status = document.getElementById('search-status');
        let indexPromise;
        let searchVersion = 0;
        async function search() {
            const query = input.value.trim();
            const version = ++searchVersion;
            const target = new URL(location.href);
            target.search = query ? '?q='+encodeURIComponent(query) : '';
            history.replaceState(null,'',target);
            results.replaceChildren();
            if (!query) { status.textContent='검색어를 입력하세요.';return; }
            status.textContent='검색 중…';
            try {
                indexPromise ||= fetch(data.search_url).then(response => {
                    if (!response.ok) throw new Error('Search index unavailable');
                    return response.json();
                }).catch(error => { indexPromise=undefined;throw error; });
                const index = await indexPromise;
                if (version !== searchVersion) return;
                const words = query.toLocaleLowerCase().split(/\s+/);
                const matches = index.filter(doc => words.every(word => (doc.title+' '+doc.book+' '+doc.text+' '+doc.categories.join(' ')).toLocaleLowerCase().includes(word)));
                status.textContent = `${matches.length}개 레시피` + (matches.length>100 ? ' · 앞의 100개 표시' : '');
                matches.slice(0,100).forEach(doc => {
                    const article = document.createElement('article');
                    article.className='search-result';
                    const h2=document.createElement('h2'), link=document.createElement('a');
                    link.href=doc.url;link.textContent=doc.title;h2.appendChild(link);
                    const book=document.createElement('p');book.textContent=doc.book;
                    const snippet=document.createElement('p');snippet.textContent=doc.text.slice(0,170);
                    article.append(h2,book,snippet);results.appendChild(article);
                });
            } catch { if(version===searchVersion) status.textContent='검색을 불러오지 못했습니다. 전체 목록이나 분류 링크를 이용하세요.'; }
        }
        input.value=new URL(location.href).searchParams.get('q')||'';
        form.addEventListener('submit',event=>{event.preventDefault();search();});
        search();
    }
});

/* Existing contact form integration. */
document.addEventListener('DOMContentLoaded', () => {
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
    if (location.hash === '#contact') showContactView();


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
