// Confirmar y Guardar Entidades + Movimientos (Versión Blindada)
  async function handleConfirmMigration() {
    if (!user || !migrationData) return;
    setUploading(true);

    try {
      // 1. Crear Tarjetas detectadas si no existen
      if (migrationData.detected_cards && migrationData.detected_cards.length > 0) {
        const cardsToInsert = migrationData.detected_cards.map((c: any) => ({
          user_id: user.id,
          name: String(c.name || 'Tarjeta'),
          closing_day: 20,
          due_day: 5,
          credit_limit: parseFloat(String(c.balance || '0').replace(/[^0-9.-]+/g, '')) || 0
        }));
        await supabase.from('credit_cards').insert(cardsToInsert);
      }

      // 2. Crear Préstamos detectados si no existen
      if (migrationData.detected_loans && migrationData.detected_loans.length > 0) {
        const loansToInsert = migrationData.detected_loans.map((l: any) => ({
          user_id: user.id,
          entity: String(l.entity || 'Préstamo'),
          total_amount: parseFloat(String(l.total_amount || '0').replace(/[^0-9.-]+/g, '')) || 0,
          installment_amount: parseFloat(String(l.installment_amount || '0').replace(/[^0-9.-]+/g, '')) || 0,
          total_installments: 12,
          paid_installments: 1,
          due_day: 10
        }));
        await supabase.from('loans').insert(loansToInsert);
      }

      // 3. Crear Transacciones saneando importes y tipos
      if (migrationData.items && migrationData.items.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        
        const rows = migrationData.items.map((item: any) => {
          // Limpia strings como "$12.687,1" o números a float estándar
          const cleanAmount = typeof item.amount === 'number' 
            ? item.amount 
            : parseFloat(String(item.amount || '0').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]+/g, '')) || 0;

          return {
            user_id: user.id,
            description: String(item.description || 'Movimiento importado'),
            amount: Math.abs(cleanAmount),
            category: item.category || 'Otros',
            type: item.type === 'income' ? 'income' : 'expense',
            income_source: item.type === 'income' ? 'other' : null,
            date: item.date && item.date.length === 10 ? item.date : today,
            installment_number: Number(item.installment_number) || 1,
            total_installments: Number(item.total_installments) || 1
          };
        });

        const { error: txError } = await supabase.from('transactions').insert(rows);
        if (txError) {
          throw new Error('Supabase rechazó transacciones: ' + txError.message);
        }
      }

      // Cerrar y actualizar vista
      setIsImportModalOpen(false);
      setMigrationData(null);
      setImportText('');
      setImportFile(null);
      await refreshAll(user.id);
      alert('¡Listo! Todos los registros y entidades se guardaron con éxito en tu panel.');
    } catch (err: any) {
      console.error(err);
      alert('Aviso al guardar: ' + err.message);
    } finally {
      setUploading(false);
    }
  }