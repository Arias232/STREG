import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('https://c3fa-181-78-107-102.ngrok-free.app/');

function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [participants, setParticipants] = useState([]);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [iceServers, setIceServers] = useState([]);

  useEffect(() => {
    const fetchIceServers = async () => {
      const response = await fetch("https://umg.metered.live/api/v1/turn/credentials?apiKey=fda95ba0c7ed8dff4d19e711a309284aa390");
      const data = await response.json();
      setIceServers(data);
    };
    fetchIceServers();
  }, []);

  useEffect(() => {
    if (!joined || iceServers.length === 0) return;

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit('join-room', roomId);

      socket.on('user-joined', async (socketId) => {
        setParticipants(prev => [...prev, socketId]);
        const pc = createPeerConnection(socketId);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('offer', { to: socketId, sdp: offer });
        peerConnectionsRef.current.set(socketId, pc);
      });

      socket.on('offer', async ({ from, sdp }) => {
        setParticipants(prev => [...prev, from]);
        const pc = createPeerConnection(from);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer', { to: from, sdp: answer });
        peerConnectionsRef.current.set(from, pc);
      });

      socket.on('answer', async ({ from, sdp }) => {
        const pc = peerConnectionsRef.current.get(from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      });

      socket.on('ice-candidate', async ({ from, candidate }) => {
        const pc = peerConnectionsRef.current.get(from);
        if (pc && candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error(err);
          }
        }
      });

      socket.on('user-disconnected', (socketId) => {
        const pc = peerConnectionsRef.current.get(socketId);
        if (pc) pc.close();
        peerConnectionsRef.current.delete(socketId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(socketId);
          return newMap;
        });
        setParticipants(prev => prev.filter(id => id !== socketId));
      });
    };

    start();
  }, [joined, iceServers]);

  const createPeerConnection = (socketId) => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: socketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(socketId, event.streams[0]);
        return newMap;
      });
    };

    return pc;
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMicOn(track.enabled);
      });
    }
  };


  socket.on('connect', () => {
    console.log('🟢 Conectado al servidor con ID:', socket.id);
  });
  
  socket.on('connect_error', (err) => {
    console.log('🔴 Error de conexión:', err);
  });
  
  socket.on('disconnect', () => {
    console.log('🔴 Desconectado del servidor');
  });
  

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsCamOn(track.enabled);
      });
    }
  };

  const handleJoin = () => {
    if (roomId.trim() !== '') {
      setJoined(true);
    }
  };

  return (
    <div className="p-4">
      {!joined ? (
        <div className="max-w-sm mx-auto">
          <h1 className="text-2xl font-bold mb-4">Unirse a una sala</h1>
          <input
            type="text"
            placeholder="ID de la sala"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button
            onClick={handleJoin}
            className="w-full bg-blue-600 text-white py-2 rounded"
          >
            Unirse
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold mb-4">Sala: {roomId}</h1>

          <div className="flex gap-4 mb-4">
            <button
              onClick={toggleMic}
              className={`px-4 py-2 rounded ${isMicOn ? 'bg-green-500' : 'bg-red-500'} text-white`}
            >
              {isMicOn ? 'Micrófono ON' : 'Micrófono OFF'}
            </button>

            <button
              onClick={toggleCam}
              className={`px-4 py-2 rounded ${isCamOn ? 'bg-green-500' : 'bg-red-500'} text-white`}
            >
              {isCamOn ? 'Cámara ON' : 'Cámara OFF'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold mb-2">Tú</h2>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded border"
              />
            </div>

            <div>
              <h2 className="font-semibold mb-2">Participantes ({participants.length})</h2>
              {Array.from(remoteStreams.entries()).map(([socketId, stream]) => (
                <video
                  key={socketId}
                  ref={video => {
                    if (video) video.srcObject = stream;
                  }}
                  autoPlay
                  playsInline
                  className="w-full rounded border mb-2"
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
