import {useEffect, useRef, useState} from "react";
import type {ChangeEvent, FormEvent} from "react";
import {sketchOnHover} from "../lib/sketch";

const WEB3FORMS_KEY = import.meta.env.PUBLIC_WEB3FORMS_KEY;

/** Contact form as loose text: italic serif labels in the chapter's peach,
 *  fields that are a single hairline, and a big bold "Send." in the voice of
 *  the project titles. No card, no chrome (global.css: .field-label,
 *  .contact-field). */
export default function ContactForm() {
    const [form, setForm] = useState({name: "", email: "", message: ""});
    const [status, setStatus] = useState<{loading: boolean; ok: boolean | null; error: string}>({
        loading: false, ok: null, error: ""
    });
    const [robot, setRobot] = useState("");
    // Survives the form reset, so the success state can name the address the
    // reply is going to.
    const [sentTo, setSentTo] = useState("");
    const sendRef = useRef<HTMLButtonElement>(null);

    // The send button gets the same rough underline the nav links draw on
    // hover, in the chapter's peach. Re-wired whenever the form (re)appears.
    useEffect(() => {
        const el = sendRef.current;
        if (!el) return;
        return sketchOnHover(el, {
            color: "#ffb84d",
            type: "underline",
            strokeWidth: 2,
            padding: 4,
            drawMs: 420,
            undrawMs: 220,
        });
    }, [status.ok]);

    const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({...f, [e.target.name]: e.target.value}));

    const reset = () => {
        setStatus({loading: false, ok: null, error: ""});
        setSentTo("");
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (robot) return;
        // Fail loudly rather than posting to web3forms without an access key
        // and surfacing whatever HTTP error comes back.
        if (!WEB3FORMS_KEY) {
            setStatus({
                loading: false,
                ok: false,
                error: "The form is not wired up yet. Mail larsnilsandreas@pm.me instead.",
            });
            return;
        }
        setStatus({loading: true, ok: null, error: ""});
        try {
            const res = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: {"Content-Type": "application/json", "Accept": "application/json"},
                body: JSON.stringify({
                    access_key: WEB3FORMS_KEY,
                    name: form.name,
                    email: form.email,
                    message: form.message,
                    subject: `Portfolio contact from ${form.name}`,
                    from_name: "Portfolio Contact Form",
                }),
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || `HTTP error ${res.status}`);
            }
            setSentTo(form.email);
            setStatus({loading: false, ok: true, error: ""});
            setForm({name: "", email: "", message: ""});
        } catch (err: any) {
            const msg = err.message === "Failed to fetch"
                ? "The message did not go through. Try larsnilsandreas@pm.me instead."
                : err.message || "Something went wrong.";
            setStatus({loading: false, ok: false, error: msg});
        }
    };

    return (
        <div className="max-w-xl mx-auto">
            {/* Live region: the swap from form to sent state, and any
                error under the send button, get announced. */}
            <div aria-live="polite">
            {status.ok ? (
            <div className="space-y-3">
                <p className="font-bold text-3xl lg:text-4xl leading-none text-white">
                    Message sent<span className="text-ctp-peach">.</span>
                </p>
                <p className="text-base text-zinc-300">
                    I&apos;ll get back to you at {sentTo}
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="pt-2 font-mono text-sm text-zinc-400 hover:text-white transition-colors duration-200"
                >
                    write another
                </button>
            </div>
            ) : (
            <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
                <input
                    name="company"
                    autoComplete="off"
                    className="hidden"
                    tabIndex={-1}
                    value={robot}
                    onChange={(e) => setRobot(e.target.value)}
                />

                <label className="block">
                    <span className="field-label">Name</span>
                    <input
                        name="name"
                        required
                        autoComplete="name"
                        maxLength={80}
                        value={form.name}
                        onChange={onChange}
                        className="contact-field"
                        placeholder="Your name"
                    />
                </label>

                <label className="block">
                    <span className="field-label">Email</span>
                    <input
                        type="email"
                        name="email"
                        required
                        autoComplete="email"
                        maxLength={120}
                        value={form.email}
                        onChange={onChange}
                        className="contact-field"
                        placeholder="your@email.com"
                    />
                </label>

                <label className="block">
                    <span className="field-label">Message</span>
                    <textarea
                        name="message"
                        required
                        maxLength={2000}
                        rows={4}
                        value={form.message}
                        onChange={onChange}
                        className="contact-field resize-none h-20 lg:h-auto"
                        placeholder="What's on your mind?"
                    />
                </label>

                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 pt-1">
                    <button
                        ref={sendRef}
                        type="submit"
                        disabled={status.loading}
                        className="font-bold text-3xl lg:text-4xl leading-none text-white
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-transform duration-300 hover:translate-x-1"
                    >
                        {status.loading ? "Sending" : "Send"}<span className="text-ctp-peach">.</span>
                    </button>

                    {status.ok === false && (
                        <p className="text-sm text-ctp-red">{status.error}</p>
                    )}
                </div>
            </form>
            )}
            </div>
        </div>
    );
}
