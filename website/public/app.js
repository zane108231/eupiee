const grid = document.querySelector("#bot-grid");
const count = document.querySelector("#bot-count");
const message = document.querySelector("#site-message");
const heroAvatars = document.querySelector("#hero-avatars");

document.querySelector("#year").textContent = new Date().getFullYear();

// Navbar scroll state + mobile menu
const navbar = document.querySelector(".navbar");
const navToggle = document.querySelector("#nav-toggle");
const navLinks = document.querySelector("#nav-links");

const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 12);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
        const open = navLinks.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(open));
    });
    navLinks.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
            navLinks.classList.remove("open");
            navToggle.setAttribute("aria-expanded", "false");
        }
    });
}

// Scroll reveal
const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
        }
    }
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

for (const el of document.querySelectorAll(".reveal")) {
    revealObserver.observe(el);
}
// Reveal dynamically-added cards when they render
const gridObserver = new MutationObserver(() => {
    for (const el of grid.querySelectorAll(".reveal:not(.in-view)")) {
        revealObserver.observe(el);
    }
});
gridObserver.observe(grid, { childList: true });

function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
    window.setTimeout(() => {
        message.hidden = true;
    }, 4200);
}

function isInviteUrl(value) {
    if (typeof value !== "string" || !value) return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:"
            && ["discord.com", "discordapp.com"].includes(url.hostname)
            && url.pathname.startsWith("/oauth2/authorize");
    } catch {
        return false;
    }
}

function addHeroAvatar(bot) {
    if (!heroAvatars || typeof bot.avatar !== "string" || !bot.avatar) return;
    const img = document.createElement("img");
    img.src = bot.avatar;
    img.alt = "";
    img.loading = "lazy";
    heroAvatars.append(img);
}

function createBotCard(bot, index) {
    const hasInvite = isInviteUrl(bot.inviteUrl);
    const card = document.createElement("article");
    card.className = `card bot-card reveal d${(index % 3) + 1}`;

    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    if (typeof bot.avatar === "string" && bot.avatar) {
        const img = document.createElement("img");
        img.src = bot.avatar;
        img.alt = `${bot.name} avatar`;
        img.loading = "lazy";
        avatar.append(img);
    } else {
        avatar.textContent = bot.name.trim().charAt(0).toUpperCase() || "E";
    }

    const title = document.createElement("h3");
    title.textContent = bot.name;

    const tagline = document.createElement("span");
    tagline.className = "bot-tagline";
    tagline.textContent = bot.tagline || "A little more music, together.";

    const description = document.createElement("p");
    description.textContent = bot.description;

    const tags = document.createElement("div");
    tags.className = "bot-tags";
    for (const command of (Array.isArray(bot.commands) ? bot.commands : []).slice(0, 4)) {
        const tag = document.createElement("span");
        tag.textContent = command;
        tags.append(tag);
    }

    const invite = document.createElement(hasInvite ? "a" : "button");
    invite.className = "bot-invite" + (hasInvite ? "" : " is-pending");
    if (hasInvite) {
        invite.href = bot.inviteUrl;
        invite.target = "_blank";
        invite.rel = "noopener noreferrer";
    } else {
        invite.type = "button";
        invite.disabled = true;
        invite.title = `Add the Discord invite URL for ${bot.name} in data/bots.json to activate this button.`;
    }
    invite.setAttribute("aria-label", hasInvite
        ? `Invite ${bot.name} to your Discord server`
        : `Invite link for ${bot.name} has not been added yet`);
    invite.textContent = hasInvite ? "Add to Discord ↗" : "Invite coming soon";

    card.append(avatar, title, tagline, description, tags, invite);
    return card;
}

function renderBots(bots) {
    const readyCount = bots.filter((bot) => isInviteUrl(bot.inviteUrl)).length;
    count.textContent = `${readyCount} of ${bots.length} bots ready to invite`;
    grid.replaceChildren();
    grid.append(...bots.map((bot, i) => createBotCard(bot, i)));
}

async function loadBots() {
    try {
        const response = await fetch("/api/bots", { headers: { Accept: "application/json" } });
        if (!response.ok) {
            throw new Error(`The bot directory returned ${response.status}.`);
        }
        const result = await response.json();
        if (!Array.isArray(result)) {
            throw new Error("The bot directory response was not a list.");
        }
        const bots = result.filter((bot) =>
            bot
            && typeof bot.name === "string"
            && typeof bot.description === "string"
        );
        if (bots.length === 0) {
            throw new Error("The bot directory is empty.");
        }
        bots.forEach(addHeroAvatar);
        renderBots(bots);
    } catch (error) {
        console.error("[website] Could not load the bot directory:", error);
        count.textContent = "Directory unavailable";
        const errorCard = document.createElement("div");
        errorCard.className = "card error-card";
        errorCard.textContent = "We couldn't load the bot directory. Please try again in a moment.";
        grid.replaceChildren(errorCard);
        showMessage("The Euphie crew is temporarily unavailable.");
    }
}

loadBots();
