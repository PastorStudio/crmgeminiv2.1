import React, { useState } from 'react';
import { Link } from 'wouter';

// Componente principal
export default function SimpleWhatsAppDemo() {
  // Datos de demostración
  const demoAccounts = [
    { id: 1, name: "Ventas", description: "Cuenta principal de ventas", status: "CONNECTED" },
    { id: 2, name: "Soporte", description: "Soporte técnico", status: "CONNECTED" },
    { id: 3, name: "REp. Dom", description: "República Dominicana", status: "CONNECTED" }
  ];

  const demoChats = [
    { id: "11234567890@c.us", name: "Cliente Juan Pérez", isGroup: false, lastMessage: "¿Cuándo estará disponible el producto?", timestamp: Date.now() - 3600000 },
    { id: "19876543210@c.us", name: "Cliente María López", isGroup: false, lastMessage: "Gracias por la atención", timestamp: Date.now() - 7200000 },
    { id: "120363123456789@g.us", name: "Grupo de Ventas", isGroup: true, lastMessage: "Nueva promoción disponible", timestamp: Date.now() - 1800000 },
    { id: "13334445555@c.us", name: "Cliente Pedro Rodríguez", isGroup: false, lastMessage: "Necesito información sobre precios", timestamp: Date.now() - 10800000 },
    { id: "16667778888@c.us", name: "Cliente Ana Martínez", isGroup: false, lastMessage: "¿Tienen servicio de entrega?", timestamp: Date.now() - 14400000 }
  ];

  const demoMessages = {
    "11234567890@c.us": [
      { id: "msg1", body: "Hola, me gustaría saber cuándo estará disponible el nuevo modelo", fromMe: false, timestamp: Date.now() - 7200000 },
      { id: "msg2", body: "Buenas tardes. El nuevo modelo estará disponible a partir del próximo lunes", fromMe: true, timestamp: Date.now() - 5400000 },
      { id: "msg3", body: "Excelente, ¿y cuál será el precio?", fromMe: false, timestamp: Date.now() - 3600000 },
      { id: "msg4", body: "El precio será de $1,500. ¿Desea hacer una reserva?", fromMe: true, timestamp: Date.now() - 1800000 },
      { id: "msg5", body: "¿Cuándo estará disponible el producto?", fromMe: false, timestamp: Date.now() - 900000 }
    ],
    "19876543210@c.us": [
      { id: "msg6", body: "Tengo un problema con mi pedido #12345", fromMe: false, timestamp: Date.now() - 14400000 },
      { id: "msg7", body: "Lamento escuchar eso. ¿Podría indicarme cuál es el problema específico?", fromMe: true, timestamp: Date.now() - 12600000 },
      { id: "msg8", body: "No llegó completo, falta un accesorio", fromMe: false, timestamp: Date.now() - 10800000 },
      { id: "msg9", body: "Entiendo. Enviaremos el accesorio faltante sin costo adicional. ¿Es correcta su dirección actual?", fromMe: true, timestamp: Date.now() - 9000000 },
      { id: "msg10", body: "Sí, es correcta. Gracias por la atención", fromMe: false, timestamp: Date.now() - 7200000 }
    ],
    "120363123456789@g.us": [
      { id: "msg11", body: "Buenos días equipo, tenemos nuevos productos disponibles", fromMe: true, timestamp: Date.now() - 5400000 },
      { id: "msg12", body: "¿Cuáles son los nuevos productos?", fromMe: false, timestamp: Date.now() - 4500000, author: "Ana (Ventas)" },
      { id: "msg13", body: "Hemos incorporado la línea completa de accesorios premium", fromMe: true, timestamp: Date.now() - 3600000 },
      { id: "msg14", body: "¿Tenemos material promocional para compartir con clientes?", fromMe: false, timestamp: Date.now() - 2700000, author: "Carlos (Marketing)" },
      { id: "msg15", body: "Nueva promoción disponible", fromMe: true, timestamp: Date.now() - 1800000 }
    ],
    "13334445555@c.us": [
      { id: "msg16", body: "Buenas tardes, quisiera información sobre sus productos", fromMe: false, timestamp: Date.now() - 21600000 },
      { id: "msg17", body: "Claro, ¿qué tipo de productos le interesan?", fromMe: true, timestamp: Date.now() - 19800000 },
      { id: "msg18", body: "Estoy buscando equipos para oficina", fromMe: false, timestamp: Date.now() - 18000000 },
      { id: "msg19", body: "Tenemos varias opciones. ¿Tiene un presupuesto específico?", fromMe: true, timestamp: Date.now() - 16200000 },
      { id: "msg20", body: "Necesito información sobre precios", fromMe: false, timestamp: Date.now() - 10800000 }
    ],
    "16667778888@c.us": [
      { id: "msg21", body: "Hola, ¿cuál es el horario de atención?", fromMe: false, timestamp: Date.now() - 36000000 },
      { id: "msg22", body: "Nuestro horario es de 9am a 6pm de lunes a viernes", fromMe: true, timestamp: Date.now() - 34200000 },
      { id: "msg23", body: "Perfecto, ¿y sábados?", fromMe: false, timestamp: Date.now() - 32400000 },
      { id: "msg24", body: "Los sábados atendemos de 10am a 2pm", fromMe: true, timestamp: Date.now() - 30600000 },
      { id: "msg25", body: "¿Tienen servicio de entrega?", fromMe: false, timestamp: Date.now() - 14400000 }
    ]
  };

  // Estado
  const [selectedAccount, setSelectedAccount] = useState(demoAccounts[0].id);
  const [selectedChat, setSelectedChat] = useState(demoChats[0].id);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState(demoMessages[demoChats[0].id]);
  const [showQR, setShowQR] = useState(false);

  // Manejar selección de cuenta
  const handleAccountSelect = (accountId: number) => {
    setSelectedAccount(accountId);
  };

  // Manejar selección de chat
  const handleChatSelect = (chatId: string) => {
    setSelectedChat(chatId);
    setMessages(demoMessages[chatId] || []);
  };

  // Enviar mensaje
  const handleSendMessage = () => {
    if (newMessage.trim() === "") return;
    
    const updatedMessages = [
      ...messages,
      {
        id: `new_${Date.now()}`,
        body: newMessage,
        fromMe: true,
        timestamp: Date.now()
      }
    ];
    
    setMessages(updatedMessages);
    setNewMessage("");
    
    // Simular respuesta después de 1 segundo
    setTimeout(() => {
      const responseMessages = [
        ...updatedMessages,
        {
          id: `resp_${Date.now()}`,
          body: "Gracias por su mensaje. Un agente le atenderá en breve.",
          fromMe: false,
          timestamp: Date.now()
        }
      ];
      setMessages(responseMessages);
    }, 1000);
  };

  // Formatear fecha
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('es', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // QR Code de ejemplo
  const demoQRCode = `
████████████████████████████████████
████████████████████████████████████
████████████████████████████████████
██████████████      ██████████████████
████████████  ████  ████████████████
████████████  ████  ████████████████
██████████  ██████    ████████████████
████████  ██    ██  ██  ██████████████
████████  ██  ████  ██  ██████████████
████████  ██████  ████  ██████████████
████████  ████████████  ██████████████
████████  ████████    ████████████████
████████  ██  ██  ██  ████████████████
████████  ██████  ██  ████████████████
██████████      ████    ██████████████
████████████████████████████████████
████████████████████████████████████
  `;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Panel lateral izquierdo - Cuentas */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 font-bold text-lg">
          Cuentas de WhatsApp
        </div>
        <div className="overflow-y-auto flex-1">
          {demoAccounts.map(account => (
            <div
              key={account.id}
              className={`p-3 cursor-pointer hover:bg-gray-100 ${
                selectedAccount === account.id ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleAccountSelect(account.id)}
            >
              <div className="font-medium">{account.name}</div>
              <div className="text-sm text-gray-500">{account.description}</div>
              <div className="text-sm text-green-500">
                Conectado
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200">
          <button
            className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setShowQR(true)}
          >
            Mostrar QR
          </button>
          <Link href="/dashboard" className="block mt-2 text-center text-blue-500 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Panel central - Chats */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 font-bold text-lg">
          Chats
        </div>
        <div className="overflow-y-auto flex-1">
          {demoChats.map(chat => (
            <div
              key={chat.id}
              className={`p-3 cursor-pointer hover:bg-gray-100 ${
                selectedChat === chat.id ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleChatSelect(chat.id)}
            >
              <div className="font-medium">
                {chat.isGroup ? '👥 ' : '👤 '}
                {chat.name}
              </div>
              {chat.lastMessage && (
                <div className="text-sm text-gray-500 truncate">
                  {chat.lastMessage}
                </div>
              )}
              {chat.timestamp && (
                <div className="text-xs text-gray-400">
                  {formatTimestamp(chat.timestamp)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200">
          <button
            className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Actualizar Chats
          </button>
        </div>
      </div>

      {/* Panel de mensajes */}
      <div className="flex-1 flex flex-col">
        {/* Cabecera del chat */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center">
          <div className="flex-1">
            <div className="font-bold text-lg">
              {demoChats.find(c => c.id === selectedChat)?.name}
            </div>
            <div className="text-sm text-gray-500">
              {demoChats.find(c => c.id === selectedChat)?.isGroup
                ? 'Conversación grupal'
                : 'Conversación individual'}
            </div>
          </div>
          <button
            className="ml-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Actualizar
          </button>
        </div>

        {/* Área de mensajes */}
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
          {showQR ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="bg-white p-4 rounded shadow-md">
                <h3 className="text-lg font-bold mb-2 text-center">Escanea este código QR</h3>
                <div className="border border-gray-300 p-2">
                  <pre className="text-xs whitespace-pre font-mono">{demoQRCode}</pre>
                </div>
                <button
                  className="mt-3 w-full py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  onClick={() => setShowQR(false)}
                >
                  Cerrar QR
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded ${
                    message.fromMe
                      ? 'ml-auto bg-blue-100 text-blue-900'
                      : 'mr-auto bg-white text-gray-900'
                  }`}
                >
                  {message.author && !message.fromMe && (
                    <div className="text-xs font-bold text-gray-700">{message.author}</div>
                  )}
                  <div>{message.body}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Área de entrada de mensaje */}
        {!showQR && (
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex">
              <input
                type="text"
                className="flex-1 border border-gray-300 rounded-l py-2 px-3"
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                className="bg-green-500 text-white px-4 rounded-r hover:bg-green-600"
                onClick={handleSendMessage}
              >
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}