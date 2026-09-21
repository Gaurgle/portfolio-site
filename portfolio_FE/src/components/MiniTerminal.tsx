import { useState, useRef, useEffect } from 'react';

function getWhoami() {
    const h = new Date().getHours();
    if (h >= 1 && h < 5) return 'andreas roos  (up late hacking)';
    if (h >= 5 && h < 8) return 'andreas roos  (early bird)';
    return 'andreas roos';
}

function matrixBlock() {
    const chars = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ012789Z';
    const lines: string[] = [];
    for (let i = 0; i < 8; i++) {
        let line = '';
        for (let j = 0; j < 36; j++) line += chars[Math.floor(Math.random() * chars.length)];
        lines.push(line);
    }
    return lines.join('\n');
}

const NEOFETCH = `  ██████╗     andreas@portfolio
  ██╔══██╗    ─────────────────
  ██████╔╝    OS      portfolio-os 1.0.0
  ██╔══██╗    Host    vercel
  ██║  ██║    Kernel  astro 5.14
  ╚═╝  ╚═╝    Shell   react 19
               WM      tailwind 3.4
               Theme   catppuccin mocha
               Term    mini-terminal v1
               CPU     vite @ 6.2
               Memory  6 projects loaded
               Uptime  since 2025
               Contact larsnilsandreas@pm.me`;

const SL = `      ____
 ____|____|___oOo
|   _    _   |>
|__| |__| |__|
  (O)    (O)`;

const RESPONSES: Record<string, string> = {
    help: 'try: whoami, ls, cat about.txt, cd projects, cv, neofetch, crt, clear',
    ls: 'projects/  about.txt  contact.txt  secret.txt  cv/',
    'cat about.txt': 'backend & android dev, 36, stockholm.\nkotlin, java, spring boot, BLE, docker.',
    'ls projects': 'portfolio/  booking-program/  webshop/\n15-game/  quiz-game/  yacht-strike/',
    'ls projects/': 'portfolio/  booking-program/  webshop/\n15-game/  quiz-game/  yacht-strike/',
    pwd: '~/portfolio',
    uname: 'portfolio-os 1.0.0',
    neofetch: NEOFETCH,
    sl: SL,
    vim: "you're trapped in vim now.\ngood luck getting out.\n(just kidding, type clear)",
    'vim .': "you're trapped in vim now.\ngood luck getting out.",
    ':q': "this isn't vim... or is it?",
    ':q!': "this isn't vim... or is it?",
    ':wq': 'saved nothing to nowhere.',
    ':w': 'saved nothing to nowhere.',
    ':qa': "this isn't vim... or is it?",
    ':qa!': "this isn't vim... or is it?",
    exit: 'there is no escape.',
    top: 'PID  CMD          CPU\n  1  astro        2.1%\n  2  react        1.8%\n  3  tailwind     0.4%\n  4  pixel-eagle  0.1%',
    htop: 'PID  CMD          CPU\n  1  astro        2.1%\n  2  react        1.8%\n  3  tailwind     0.4%\n  4  pixel-eagle  0.1%',
    'cat /etc/passwd': 'nice try.',
    uptime: 'up since 2025, 6 projects loaded',
    hostname: 'portfolio.local',
    'ping google.com': 'PING google.com: 64 bytes, time=0.42ms\n...just kidding, this is a fake terminal.',
    cowsay: ' ________\n< mooo!  >\n --------\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||',
    'cat secret.txt': 'psst... type crt',
};

const NAV: Record<string, string> = {
    'cd projects': '/projects',
    'cd projects/': '/projects',
    'cd about': '/about',
    'cd contact': '/contact',
    'cd ~': '/',
    cd: '/',
};

export default function MiniTerminal() {
    const [history, setHistory] = useState<Array<{ cmd: string; out: string; className?: string }>>([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const run = (e: React.FormEvent) => {
        e.preventDefault();
        const raw = input.trim();
        const cmd = raw.toLowerCase();
        if (!cmd) return;
        setInput('');

        if (cmd === 'clear') { setHistory([]); return; }

        for (const [prefix, path] of Object.entries(NAV)) {
            if (cmd === prefix) { window.location.href = path; return; }
        }

        if (cmd === 'whoami') {
            setHistory(h => [...h, { cmd: raw, out: getWhoami() }]);
            return;
        }

        if (cmd === 'date') {
            setHistory(h => [...h, {
                cmd: raw,
                out: new Date().toLocaleDateString('en-SE', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                }),
            }]);
            return;
        }

        if (cmd === 'sudo' || cmd.startsWith('sudo ')) {
            setHistory(h => [...h, { cmd: raw, out: 'permission denied. nice try.' }]);
            return;
        }

        if (cmd === 'rm -rf /' || cmd === 'rm -rf / --no-preserve-root' || cmd === 'rm -rf /*') {
            window.dispatchEvent(new CustomEvent('rm-rf'));
            setHistory(h => [...h, {
                cmd: raw,
                out: 'removing /usr... /bin... /home...\n\n...just kidding. everything is fine.',
            }]);
            return;
        }

        if (cmd === 'matrix') {
            setHistory(h => [...h, { cmd: raw, out: matrixBlock(), className: 'text-ctp-green' }]);
            return;
        }

        if (cmd === 'eagle') {
            window.dispatchEvent(new CustomEvent('scare-eagle'));
            setHistory(h => [...h, { cmd: raw, out: '\ud83e\udd85' }]);
            return;
        }

        if (cmd === 'thebirdistheword' || cmd === 'shoottheeagle') {
            window.dispatchEvent(new CustomEvent('shoot-eagle'));
            setHistory(h => [...h, { cmd: raw, out: '\ud83d\udca5\ud83e\udd85 bang!', className: 'text-ctp-red' }]);
            return;
        }

        if (cmd === 'cv' || cmd === 'resume' || cmd === 'ls cv' || cmd === 'ls cv/') {
            setHistory(h => [...h, {
                cmd: raw,
                out: 'cv/\n  andreas-roos-cv-en.pdf\n  andreas-roos-cv-sv.pdf\n\nto download: dl cv en | dl cv sv',
            }]);
            return;
        }

        if (cmd === 'dl cv en' || cmd === 'dl cv' || cmd === 'download cv en' || cmd === 'download cv') {
            const a = document.createElement('a');
            a.href = '/cv/andreas-roos-cv-en.pdf';
            a.download = 'andreas-roos-cv-en.pdf';
            a.click();
            setHistory(h => [...h, {
                cmd: raw,
                out: 'downloading cv (en)...',
                className: 'text-ctp-green',
            }]);
            return;
        }

        if (cmd === 'dl cv sv' || cmd === 'download cv sv' || cmd === 'cv sv') {
            const a = document.createElement('a');
            a.href = '/cv/andreas-roos-cv-sv.pdf';
            a.download = 'andreas-roos-cv-sv.pdf';
            a.click();
            setHistory(h => [...h, {
                cmd: raw,
                out: 'downloading cv (sv)...',
                className: 'text-ctp-green',
            }]);
            return;
        }

        if (cmd === 'crt') {
            const active = document.body.classList.toggle('crt-mode');
            if (active) localStorage.setItem('crt-mode', '1');
            else localStorage.removeItem('crt-mode');
            setHistory(h => [...h, {
                cmd: raw,
                out: active ? 'CRT mode activated. welcome to 1990.' : 'CRT mode deactivated.',
                className: active ? 'text-ctp-green' : undefined,
            }]);
            return;
        }

        if (cmd.startsWith('echo ')) {
            setHistory(h => [...h, { cmd: raw, out: raw.slice(5) }]);
            return;
        }

        const out = RESPONSES[cmd] ?? `zsh: command not found: ${cmd.split(' ')[0]}`;
        setHistory(h => [...h, { cmd: raw, out }]);
    };

    return (
        <div
            className="terminal-card w-full cursor-text text-left"
            onClick={() => inputRef.current?.focus()}
        >
            <div className="terminal-bar">
                <span className="terminal-dot bg-ctp-red/80"></span>
                <span className="terminal-dot bg-ctp-yellow/80"></span>
                <span className="terminal-dot bg-ctp-green/80"></span>
                <span className="font-mono text-[10px] text-zinc-400 ml-2">~/portfolio</span>
            </div>
            <div ref={scrollRef} className="p-3 font-mono text-xs max-h-80 overflow-y-auto space-y-1">
                <div className="text-zinc-500">type help</div>
                {history.map((entry, i) => (
                    <div key={i}>
                        <div>
                            <span className="text-ctp-green">~ </span>
                            <span className="text-zinc-300">{entry.cmd}</span>
                        </div>
                        {entry.out && (
                            <pre className={`whitespace-pre-wrap ${entry.className ?? 'text-zinc-400'}`}>{entry.out}</pre>
                        )}
                    </div>
                ))}
                <form onSubmit={run} className="flex items-center gap-1">
                    <span className="text-ctp-green">~</span>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="bg-transparent border-none outline-none text-white flex-1"
                        style={{ caretColor: '#8dffb0' }}
                        spellCheck={false}
                        autoComplete="off"
                    />
                </form>
            </div>
        </div>
    );
}
