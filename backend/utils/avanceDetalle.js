function normalizarDetalleAvance(body = {}) {
  const tipoDetalle = body.tipo_detalle || 'sin_detalle';

  const datos = (() => {
    switch (tipoDetalle) {
      case 'movimiento':
        return {
          origen: body.origen || null,
          destino: body.destino || null,
          variedad: body.variedad || null,
          cantidad: body.cantidad ?? null,
        };
      case 'aplicacion':
        return {
          producto_quimico: body.producto_quimico || null,
          dosis: body.dosis ?? null,
          unidad: body.unidad || null,
        };
      case 'logistica':
        return {
          patente: body.patente || null,
          chofer: body.chofer || null,
          remito: body.remito || null,
          cliente: body.cliente || null,
        };
      default:
        return {};
    }
  })();

  return { tipoDetalle, datos };
}

module.exports = {
  normalizarDetalleAvance,
};
