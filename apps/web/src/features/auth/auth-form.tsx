'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import Link from 'next/link';

type Mode = 'login' | 'register' | 'recovery';
type Field = 'name' | 'email' | 'password' | 'confirm';
type Errors = Partial<Record<Field, string>>;

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AuthForm({ mode }: { mode: Mode }) {
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState('');
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const register = mode === 'register';
  const recovery = mode === 'recovery';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const get = (key: Field) => String(data.get(key) ?? '');
    const next: Errors = {};
    if (register && get('name').trim().length < 3) next.name = 'Escribe tu nombre completo (al menos 3 caracteres).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('email').trim())) next.email = 'Escribe un correo electrónico válido.';
    if (!recovery && !get('password')) next.password = 'Escribe una contraseña.';
    else if (register && get('password').length < 8) next.password = 'Utiliza al menos 8 caracteres.';
    if (register && get('confirm') !== get('password')) next.confirm = 'Las contraseñas no coinciden.';
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;
    form.reset();
    setMessage('Validación de demostración completada. No se inició sesión, creó una cuenta ni envió ningún correo.');
  }

  function field(id: Field, label: string, type: string, autoComplete: string) {
    return <div className="field"><label htmlFor={id}>{label}</label><input id={id} name={id} type={type} autoComplete={autoComplete} disabled={!ready} required aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `${id}-error` : undefined} />{errors[id] && <p className="field-error" id={`${id}-error`}>{errors[id]}</p>}</div>;
  }

  return <><div className="form-card"><p className="demo-banner">Demostración: la autenticación aún no está disponible. No uses credenciales reales.</p><noscript><p className="field-error">Activa JavaScript para utilizar este formulario de demostración.</p></noscript><form method="post" onSubmit={submit} noValidate>
    {register && field('name', 'Nombre completo', 'text', 'name')}
    {field('email', 'Correo electrónico', 'email', 'email')}
    {!recovery && field('password', 'Contraseña', 'password', register ? 'new-password' : 'current-password')}
    {register && field('confirm', 'Confirmar contraseña', 'password', 'new-password')}
    {Object.keys(errors).length > 0 && <p className="field-error" role="alert">Revisa los campos indicados.</p>}
    {message && <p className="form-message" role="status">{message}</p>}
    <button className="button primary form-submit" type="submit" disabled={!ready}>{recovery ? 'Validar solicitud de ejemplo' : register ? 'Validar registro de ejemplo' : 'Validar inicio de sesión de ejemplo'}</button>
  </form></div><div className="auth-links">{mode !== 'login' && <Link href="/login">Volver a iniciar sesión</Link>}{mode === 'login' && <><Link href="/forgot-password">¿Olvidaste tu contraseña?</Link><Link href="/register">Crear cuenta</Link></>}<Link href="/">Explorar los paneles de demostración</Link></div></>;
}
