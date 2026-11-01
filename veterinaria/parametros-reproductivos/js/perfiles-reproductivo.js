// Catálogo de perfiles para bovinos. Valores = referencias GENERALES de literatura técnica,
// pendientes de validación por profesionales de cada región.
const FUENTE_GEN = 'Referencia general orientativa (literatura técnica de reproducción bovina). Pendiente de validación profesional; ajústala a tu sistema.';
const CAMPOS_REPRO = [
  { k: 'meta_conc', label: 'Concepción por servicio', unit: '%', grupo: 'Metas en porcentaje (hembras)' },
  { k: 'meta_conc1', label: 'Concepción al 1.er servicio', unit: '%', grupo: 'Metas en porcentaje (hembras)' },
  { k: 'meta_nat', label: 'Natalidad', unit: '%', grupo: 'Metas en porcentaje (hembras)' },
  { k: 'meta_estro', label: 'Detección de estros', unit: '%', grupo: 'Metas en porcentaje (hembras)' },
  { k: 'meta_perd', label: 'Pérdidas fetales (máx.)', unit: '%', grupo: 'Metas en porcentaje (hembras)' },
  { k: 'meta_prenez', label: 'Tasa de preñez del lote', unit: '%', grupo: 'Metas en porcentaje (hembras)' },
  { k: 'ref_iep', label: 'Intervalo entre partos (máx.)', unit: 'días', grupo: 'Referencias por animal' },
  { k: 'ref_ab', label: 'Días abiertos (máx.)', unit: 'días', grupo: 'Referencias por animal' },
  { k: 'ref_sc', label: 'Servicios por concepción (máx.)', unit: 'serv.', grupo: 'Referencias por animal' },
  { k: 'ref_epp', label: 'Edad al primer parto (máx.)', unit: 'meses', grupo: 'Referencias por animal' },
  { k: 'ref_eps', label: 'Edad al primer servicio (máx.)', unit: 'meses', grupo: 'Referencias por animal' },
  { k: 'ref_pub', label: 'Edad a la pubertad (máx.)', unit: 'meses', grupo: 'Referencias por animal' },
  { k: 'ref_ges', label: 'Gestación esperada', unit: 'días', grupo: 'Referencias por animal' },
  { k: 'ref_seco', label: 'Período seco (mín.)', unit: 'días', grupo: 'Referencias por animal' },
  { k: 'ce_min24', label: 'Circ. escrotal mínima a ≥24 meses (taurino)', unit: 'cm', grupo: 'Macho' },
  { k: 'ce_cebu', label: 'Ajuste para cebú (resta)', unit: 'cm', grupo: 'Macho' },
  { k: 'sem_mot', label: 'Motilidad mínima', unit: '%', grupo: 'Macho' },
  { k: 'sem_morf', label: 'Morfología normal mínima', unit: '%', grupo: 'Macho' },
  { k: 'sem_conc', label: 'Concentración mínima', unit: '×10⁶/mL', grupo: 'Macho' }
];
const CATALOGO_REPRO = {
  general: { nombre: 'Referencia general', fuente: FUENTE_GEN, valores: { meta_conc: 50, meta_conc1: 55, meta_nat: 80, meta_estro: 50, meta_perd: 5, meta_prenez: 70, ref_iep: 400, ref_ab: 120, ref_sc: 2, ref_epp: 30, ref_eps: 24, ref_pub: 16, ref_ges: 283, ref_seco: 55, ce_min24: 34, ce_cebu: 1, sem_mot: 60, sem_morf: 70, sem_conc: 500 } },
  leche: { nombre: 'Lechería especializada', fuente: FUENTE_GEN + ' Perfil orientado a Holstein/Jersey con IA.', valores: { meta_conc: 55, meta_conc1: 55, meta_nat: 85, meta_estro: 55, meta_perd: 5, meta_prenez: 70, ref_iep: 400, ref_ab: 120, ref_sc: 2, ref_epp: 26, ref_eps: 15, ref_pub: 12, ref_ges: 280, ref_seco: 55, ce_min24: 34, ce_cebu: 0, sem_mot: 60, sem_morf: 70, sem_conc: 500 } },
  doble: { nombre: 'Doble propósito trópico bajo', fuente: FUENTE_GEN + ' Perfil orientado a cruces cebú × taurino en trópico bajo; metas más holgadas.', valores: { meta_conc: 45, meta_conc1: 50, meta_nat: 75, meta_estro: 45, meta_perd: 6, meta_prenez: 60, ref_iep: 450, ref_ab: 150, ref_sc: 2.2, ref_epp: 36, ref_eps: 26, ref_pub: 20, ref_ges: 285, ref_seco: 55, ce_min24: 33, ce_cebu: 2, sem_mot: 60, sem_morf: 70, sem_conc: 500 } },
  carne: { nombre: 'Carne – cría extensiva', fuente: FUENTE_GEN + ' Perfil orientado a vaca-cría con monta natural o estacional.', valores: { meta_conc: 55, meta_conc1: 55, meta_nat: 75, meta_estro: 50, meta_perd: 5, meta_prenez: 75, ref_iep: 400, ref_ab: 110, ref_sc: 1.8, ref_epp: 33, ref_eps: 24, ref_pub: 16, ref_ges: 285, ref_seco: 55, ce_min24: 34, ce_cebu: 2, sem_mot: 60, sem_morf: 70, sem_conc: 500 } }
};
