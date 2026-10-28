import {useEffect, useRef, useState} from "react";
import type {ChangeEvent, FocusEvent, FormEvent} from "react";
import {sketchOnHover} from "../lib/sketch";

const WEB3FORMS_KEY = import.meta.env.PUBLIC_WEB3FORMS_KEY;

/** Something@something.tld: catches typos, leaves real validation to the
 *  reply actually arriving. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shown for any failed send, instead of whatever the provider or the
 *  network reported. The form keeps its values, so a retry is one press. */
const SEND_FAILED = "That didn't send. Please try again, or email larsnilsandreas@pm.me.";

/** Contact form as loose text: wide, light labels, fields that are a single
 *  hairline, and a big bold "Send" in the voice of the project titles. No
 *  card, no chrome (global.css: .field-label, .contact-field). The email is
 *  checked as the visitor leaves the field, not on submit. */
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
    // Shown once the email field has been left with a malformed address;
    // cleared as soon as the address takes a valid shape.
    const [emailError, setEmailError] = useState("");

    // The send button gets the same rough underline the nav links draw on
    // hover. Re-wired whenever the form (re)appears.
    useEffect(() => {
        const el = sendRef.current;
        if (!el) return;
        return sketchOnHover(el, {
            color: "rgb(184 197 214)",
            type: "underline",
            strokeWidth: 2,
            padding: 4,
            drawMs: 420,
            undrawMs: 220,
        });
    }, [status.ok]);

    const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const {name, value} = e.target;
        setForm((f) => ({...f, [name]: value}));
        if (name === "email" && emailError && EMAIL_SHAPE.test(value.trim())) setEmailError("");
    };

    const onEmailBlur = (e: FocusEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setEmailError(value && !EMAIL_SHAPE.test(value)
            ? "That address looks incomplete. Check for a typo?"
            : "");
    };

    const reset = () => {
        setStatus({loading: false, ok: null, error: ""});
        setSentTo("");
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (robot) return;
        if (!EMAIL_SHAPE.test(form.email.trim())) {
            setEmailError("That address looks incomplete. Check for a typo?");
            return;
        }
        // Fail loudly rather than posting to web3forms without an access key
        // and surfacing whatever HTTP error comes back.
        if (!WEB3FORMS_KEY) {
            setStatus({
                loading: false,
                ok: false,
                error: "The form is unavailable. Email me at larsnilsandreas@pm.me instead.",
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
                    subject: `Portfolio message from ${form.name}`,
                    from_name: "Andreas Roos Portfolio",
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || `HTTP error ${res.status}`);
            setSentTo(form.email);
            setStatus({loading: false, ok: true, error: ""});
            setForm({name: "", email: "", message: ""});
        } catch {
            setStatus({loading: false, ok: false, error: SEND_FAILED});
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
                    Thanks for the message
                </p>
                <p className="text-base text-zinc-300">
                    Reply address: {sentTo}
                </p>
                <button
                    type="button"
                    onClick={reset}
                    className="press pt-2 text-sm text-zinc-400 hover:text-white"
                >
                    Send another message
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
                        onBlur={onEmailBlur}
                        aria-invalid={emailError ? true : undefined}
                        aria-describedby={emailError ? "email-error" : undefined}
                        className="contact-field"
                        placeholder="Your email address"
                    />
                    {emailError && (
                        <span id="email-error" className="field-error">{emailError}</span>
                    )}
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
                        placeholder="What would you like to talk about?"
                    />
                </label>

                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 pt-1">
                    <button
                        ref={sendRef}
                        type="submit"
                        disabled={status.loading}
                        className="press font-bold text-3xl lg:text-4xl leading-none text-white
                                   disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-1"
                    >
                        {status.loading
                            ? <>Sending<span className="sending-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></>
                            : "Send"}
                    </button>

                    {status.ok === false && (
                        <p className="field-error">{status.error}</p>
                    )}
                </div>
            </form>
            )}
            </div>
        </div>
    );
}
