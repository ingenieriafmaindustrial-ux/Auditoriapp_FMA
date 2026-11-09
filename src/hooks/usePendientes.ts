import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useUsuario } from '../context/AuthContext';
import { semaforoPlazo } from '../domain/hallazgoReglas';
import { DIAS_AVISO_PROGRAMA, TIPO_PROGRAMA, asignadoA, construirEventos } from '../domain/programa';
import { diasHasta, fmtFecha } from '../lib/dates';

export interface Pendiente {
  id: string;
  tipo: 'revision' | 'observacion' | 'vencido' | 'agenda' | 'atrasada';
  titulo: string;
  detalle: string;
  to: string;
}

/** Recordatorios del usuario: informes por aprobar (líder), auditorías devueltas, NC vencidas y auditorías programadas próximas o atrasadas. */
export function usePendientes() {
  const u = useUsuario();
  const { auditorias, hallazgos, programa, mapa } = useData();

  return useMemo(() => {
    const items: Pendiente[] = [];
    const esLiderDe = (liderId: string) => u.rol === 'auditor_lider' || (!!u.auditorId && u.auditorId === liderId);

    auditorias
      .filter((a) => a.estado === 'en_revision' && esLiderDe(a.auditorLiderId))
      .forEach((a) => {
        const envio = [...(a.revisiones ?? [])].reverse().find((r) => r.tipo === 'envio');
        items.push({
          id: `rev-${a.id}-${envio?.id ?? ''}`,
          tipo: 'revision',
          titulo: `Informe ${a.codigo} por revisar y aprobar`,
          detalle: `${mapa.areas[a.areaId]?.nombre ?? ''}${envio ? ` · enviado por ${envio.usuarioNombre}` : ''}`,
          to: `/auditorias/${a.id}#cierre`,
        });
      });

    auditorias
      .filter((a) => a.estado === 'en_ejecucion' && !!u.auditorId && a.participantes.includes(u.auditorId))
      .forEach((a) => {
        const ult = (a.revisiones ?? []).at(-1);
        if (ult?.tipo === 'observacion')
          items.push({ id: `obs-${a.id}-${ult.id}`, tipo: 'observacion', titulo: `Auditoría ${a.codigo} devuelta con observaciones`, detalle: ult.comentario, to: `/auditorias/${a.id}#cierre` });
      });

    hallazgos
      .filter((h) => h.tipo === 'NC' && semaforoPlazo(h) === 'vencido')
      .forEach((h) =>
        items.push({ id: `venc-${h.id}`, tipo: 'vencido', titulo: `NC ${mapa.auditorias[h.auditoriaId]?.codigo ?? ''} #${h.correlativo} vencida`, detalle: mapa.areas[h.areaId]?.nombre ?? '', to: `/hallazgos/${h.id}` }),
      );

    // Programa anual: lo que le toca al usuario en los próximos días y lo atrasado
    const eventos = construirEventos(programa, auditorias);
    eventos
      .filter((e) => asignadoA(e, u) && (e.estado === 'proxima' || (e.estado === 'programada' && diasHasta(e.fecha) <= DIAS_AVISO_PROGRAMA)))
      .forEach((e) => {
        const d = diasHasta(e.fecha);
        const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`;
        const rol = e.liderId === u.auditorId ? 'auditor líder' : 'equipo auditor';
        items.push({ id: `ag-${e.id}-${e.fecha}`, tipo: 'agenda', titulo: `${TIPO_PROGRAMA[e.tipo].label} ${mapa.areas[e.areaId]?.nombre ?? ''} ${cuando}`, detalle: `${fmtFecha(e.fecha)} · ${mapa.sucursales[e.sucursalId]?.nombre ?? ''} · participas como ${rol}`, to: `/calendario?ver=${e.id}` });
      });
    eventos
      .filter((e) => e.estado === 'atrasada' && (asignadoA(e, u) || u.rol === 'auditor_lider'))
      .forEach((e) =>
        items.push({ id: `atr-${e.id}`, tipo: 'atrasada', titulo: `${TIPO_PROGRAMA[e.tipo].label} ${mapa.areas[e.areaId]?.nombre ?? ''} atrasada`, detalle: `Programada para el ${fmtFecha(e.fecha)} y aún no se registra: realízala o reprográmala.`, to: `/calendario?ver=${e.id}` }),
      );

    return {
      items,
      agenda: items.filter((i) => i.tipo === 'agenda' || i.tipo === 'atrasada'),
      revisiones: items.filter((i) => i.tipo === 'revision'),
      observaciones: items.filter((i) => i.tipo === 'observacion'),
      vencidos: items.filter((i) => i.tipo === 'vencido'),
    };
  }, [u, auditorias, hallazgos, programa, mapa]);
}
