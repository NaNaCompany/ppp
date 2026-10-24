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
