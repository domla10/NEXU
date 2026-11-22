'use client';
import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/ui';
import { AdminCourses } from '@/features/courses/admin-courses';
import { EnrollmentPanel } from '@/features/courses/enrollment-panel';

type Area = 'cursos' | 'inscripciones' | 'solicitudes';
const titles = { cursos: 'Gestión de cursos', inscripciones: 'Inscripciones', solicitudes: 'Solicitudes' };

export default function AdminPage() {
  const [area, setArea] = useState<Area | null>(null);
  const previousArea = useRef<Area | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (area) {
      previousArea.current = area;
      heading.current?.focus();
    } else if (previousArea.current) {
      document.getElementById(`open-${previousArea.current}`)?.focus();
    }
  }, [area]);

  return <><Header/><main className="content admin-area">
    <p className="eyebrow">ADMINISTRACIÓN · DEMOSTRACIÓN</p>
    {area ? <>
      <button type="button" className="back-link" onClick={() => setArea(null)}>← Panel de administración</button>
      <h1 ref={heading} tabIndex={-1}>{titles[area]}</h1>
    </> : <>
      <h1>Administración</h1>
      <p className="intro">Datos ficticios guardados en este navegador.</p>
      <div className="course-actions">{(Object.keys(titles) as Area[]).map(key =>
        <button type="button" id={`open-${key}`} key={key} className="course-action course-action-secondary" onClick={() => setArea(key)}>
          <span className="action-copy"><strong>{titles[key]}</strong></span><span aria-hidden="true">→</span>
        </button>
      )}</div>
    </>}
    <div hidden={area !== 'cursos'}><AdminCourses/></div>
    <div hidden={area !== 'inscripciones'}><EnrollmentPanel role="administrador" mode="inscripciones"/></div>
    <div hidden={area !== 'solicitudes'}><EnrollmentPanel role="administrador" mode="solicitudes"/></div>
  </main></>;
}
