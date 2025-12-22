import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

const UIContext = createContext();

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
};

export const UIProvider = ({ children }) => {
    // --- TOAST STATE ---
    const [toasts, setToasts] = useState([]);

    // --- MODAL STATE ---
    const [modalConfig, setModalConfig] = useState(null); // { title, message, type, onConfirm, onCancel, confirmText, cancelText }
    const resolver = useRef(null);

    // --- TOAST LOGIC ---
    const showToast = useCallback((type, message, duration = 3000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // --- MODAL LOGIC ---
    const confirm = useCallback(({ title, message, type = 'info', confirmText = 'Confirmar', cancelText = 'Cancelar' }) => {
        return new Promise((resolve) => {
            setModalConfig({
                title,
                message,
                type,
                confirmText,
                cancelText
            });
            resolver.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        if (resolver.current) resolver.current(true);
        closeModal();
    };

    const handleCancel = () => {
        if (resolver.current) resolver.current(false);
        closeModal();
    };

    const closeModal = () => {
        setModalConfig(null);
        resolver.current = null;
    };

    return (
        <UIContext.Provider value={{ showToast, confirm }}>
            {children}

            {/* GLOBAL TOAST CONTAINER */}
            <div style={{
                position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
                display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
                {toasts.map(toast => (
                    <div key={toast.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 16px', borderRadius: '8px',
                        backgroundColor: '#fff',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        borderLeft: `4px solid ${toast.type === 'success' ? '#22c55e' :
                                toast.type === 'error' ? '#ef4444' :
                                    toast.type === 'warning' ? '#f59e0b' : '#3b82f6'
                            }`,
                        minWidth: '300px', animation: 'slideIn 0.3s ease-out'
                    }}>
                        {toast.type === 'success' && <CheckCircle size={20} color="#22c55e" />}
                        {toast.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
                        {toast.type === 'warning' && <AlertTriangle size={20} color="#f59e0b" />}
                        {toast.type === 'info' && <Info size={20} color="#3b82f6" />}
                        <span style={{ flex: 1, fontSize: '0.9rem', color: '#334155' }}>{toast.message}</span>
                        <button onClick={() => removeToast(toast.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* GLOBAL MODAL OVERLAY */}
            {modalConfig && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{
                        backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
                        width: '90%', maxWidth: '450px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            {modalConfig.type === 'danger' && <div style={{ padding: '10px', background: '#fee2e2', borderRadius: '50%' }}><AlertTriangle size={24} color="#ef4444" /></div>}
                            {modalConfig.type === 'warning' && <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '50%' }}><AlertTriangle size={24} color="#d97706" /></div>}
                            {modalConfig.type === 'info' && <div style={{ padding: '10px', background: '#dbeafe', borderRadius: '50%' }}><Info size={24} color="#2563eb" /></div>}

                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
                                {modalConfig.title}
                            </h3>
                        </div>

                        <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: '1.5', marginBottom: '24px' }}>
                            {modalConfig.message}
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={handleCancel} style={{
                                padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1',
                                background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: '500'
                            }}>
                                {modalConfig.cancelText}
                            </button>
                            <button onClick={handleConfirm} style={{
                                padding: '10px 16px', borderRadius: '6px', border: 'none',
                                background: modalConfig.type === 'danger' ? '#ef4444' : '#2563eb',
                                color: '#fff', cursor: 'pointer', fontWeight: '500'
                            }}>
                                {modalConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIContext.Provider>
    );
};
