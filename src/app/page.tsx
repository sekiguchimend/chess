'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayCircle, StopCircle, Rewind, FastForward, Save, ChevronLeft, Clock, Award, Trash2, LogOut} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAH-QuL263p0pPnz9pKwemXep31f6hFf5w",
  authDomain: "chess-f406b.firebaseapp.com",
  projectId: "chess-f406b",
  storageBucket: "chess-f406b.appspot.com",
  messagingSenderId: "1068172957344",
  appId: "1:1068172957344:web:e5144046a8fab130075bc5",
  measurementId: "G-KHZ5ZD5HS5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Types
interface Move {
  from: Square;
  to: Square;
  promotion?: 'q' | 'n' | 'r' | 'b';
}

interface SavedMove {
  id: string;
  title: string;
  moves: Move[];
  createdAt: { seconds: number };
  duration: number;
  userId: string;
  userEmail: string;
}

interface AuthFormData {
  email: string;
  password: string;
}

export default function ChessRecorder() {
  const [game, setGame] = useState<Chess>(() => new Chess());
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedMoves, setRecordedMoves] = useState<Move[]>([]);
  const [currentReplayMove, setCurrentReplayMove] = useState<number>(0);
  const [replayGame, setReplayGame] = useState<Chess>(() => new Chess());
  const [title, setTitle] = useState<string>('');
  const [savedMoves, setSavedMoves] = useState<SavedMove[]>([]);
  const [currentView, setCurrentView] = useState<'auth' | 'list' | 'record' | 'replay'>('auth');
  const [selectedReplay, setSelectedReplay] = useState<SavedMove | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authForm, setAuthForm] = useState<AuthFormData>({ email: '', password: '' });
  const [boardWidth, setBoardWidth] = useState(500);

  const loadSavedMoves = useCallback(async () => {
    try {
      const movesCollection = collection(db, 'chessMoves');
      const movesQuery = query(movesCollection, orderBy('createdAt', 'desc'));
      const movesSnapshot = await getDocs(movesQuery);
      const movesList = movesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavedMove[];
      setSavedMoves(movesList);
    } catch (error) {
      console.error("Error loading saved moves:", error);
      toast.error("Failed to load games");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setCurrentView('list');
        loadSavedMoves();
      } else {
        setCurrentView('auth');
      }
    });

    return () => unsubscribe();
  }, [loadSavedMoves]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      toast.success("Successfully logged in");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      toast.success("Account created successfully");
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Failed to create account");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Successfully logged out");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to log out");
    }
  };

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsTimerRunning(false);
    toast.success("Recording stopped");
  }, []);

  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move === null) return false;

      setGame(new Chess(game.fen()));

      if (isRecording) {
        setRecordedMoves(prev => [...prev, { from: sourceSquare, to: targetSquare, promotion: 'q' }]);
      }

      if (game.isCheckmate()) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        toast.success("Checkmate!");
        stopRecording();
      } else if (game.isDraw()) {
        stopRecording();
      }

      return true;
    } catch (error) {
      console.error("Invalid move:", error);
      toast.error("Invalid move");
      return false;
    }
  }, [game, isRecording, stopRecording]);

  useEffect(() => {
    if (currentReplayMove > 0 && selectedReplay) {
      const newGame = new Chess();
      for (let i = 0; i < currentReplayMove; i++) {
        newGame.move(selectedReplay.moves[i]);
      }
      setReplayGame(newGame);
    } else {
      setReplayGame(new Chess());
    }
  }, [currentReplayMove, selectedReplay]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setGame(new Chess());
    setRecordedMoves([]);
    setTitle('');
    setCurrentView('record');
    setTimer(0);
    setIsTimerRunning(true);
    toast.success("Recording started");
  }, []);

  const replayPrevMove = useCallback(() => {
    if (currentReplayMove > 0) {
      setCurrentReplayMove(prev => prev - 1);
    }
  }, [currentReplayMove]);

  const replayNextMove = useCallback(() => {
    if (selectedReplay && currentReplayMove < selectedReplay.moves.length) {
      setCurrentReplayMove(prev => prev + 1);
    }
  }, [selectedReplay, currentReplayMove]);

  const saveMoves = useCallback(async () => {
    if (!user) {
      toast.error('Login required');
      return;
    }
    if (title.trim() === '') {
      toast.error('Please enter a title');
      return;
    }
    try {
      await addDoc(collection(db, 'chessMoves'), {
        title: title,
        moves: recordedMoves,
        createdAt: new Date(),
        duration: timer,
        userId: user.uid,
        userEmail: user.email
      });
      setTitle('');
      loadSavedMoves();
      setCurrentView('list');
      toast.success("Game saved successfully");
    } catch (e) {
      console.error('Error adding document: ', e);
      toast.error("Failed to save game");
    }
  }, [title, recordedMoves, loadSavedMoves, timer, user]);

  const loadReplay = useCallback(async (id: string) => {
    try {
      const docRef = doc(db, 'chessMoves', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSelectedReplay(docSnap.data() as SavedMove);
        setCurrentReplayMove(0);
        setReplayGame(new Chess());
        setCurrentView('replay');
      } else {
        toast.error("Game not found");
      }
    } catch (error) {
      console.error("Error loading replay:", error);
      toast.error("Failed to load game");
    }
  }, []);

  const deleteReplay = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'chessMoves', id));
      toast.success("Game deleted");
      loadSavedMoves();
    } catch (error) {
      console.error("Error deleting replay:", error);
      toast.error("Failed to delete game");
    }
  }, [loadSavedMoves]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 768) {
        setBoardWidth(Math.min(width - 64, 280));
      } else {
        setBoardWidth(500);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[#080b14] p-8">
      <Toaster position="top-center" />
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8 relative">
          <h1 className="text-4xl font-serif text-blue-100 mb-2 tracking-wide">Chess Master</h1>
          <p className="text-blue-200/80 font-light">Record and Replay Games</p>
          {user && (
            <div className="absolute right-0 top-0 flex items-center gap-2 text-blue-100">
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="text-blue-100 hover:bg-blue-900/50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </header>

        <AnimatePresence initial={false} custom={currentView === 'list' ? -1 : 1}>
          <motion.div
            key={currentView}
            custom={currentView === 'list' ? -1 : 1}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="bg-black/40 backdrop-blur-sm rounded-lg border border-blue-900/30 p-8"
          >
            {currentView === 'auth' && (
              <div className="max-w-md mx-auto space-y-6">
                <h2 className="text-2xl font-serif text-blue-100 text-center mb-6">
                  Login / Sign Up
                </h2>
                <form className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="Email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                      className="bg-black/20 border-blue-900/30 text-blue-100 placeholder:text-blue-100/50"
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder="Password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                      className="bg-black/20 border-blue-900/30 text-blue-100 placeholder:text-blue-100/50"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <Button
                      type="button"
                      onClick={handleLogin}
                      className="flex-1 bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-700"
                    >
                      Login
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSignup}
                      className="flex-1 bg-blue-700 hover:bg-blue-600 text-blue-100 border border-blue-500"
                    >
                      Sign Up
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {currentView === 'list' && (
              <div  className="space-y-6">
                <div className="flex justify-between items-center">
                  <Button 
                    onClick={startRecording} 
                    className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-700 shadow-lg transition-all duration-200"
                  >
                    <PlayCircle className="mr-2 h-5 w-5" /> Start New Recording
                  </Button>
                </div>
                <h2 className="text-2xl font-serif text-blue-100 border-b border-blue-900/50 pb-2">
                  All Saved Games
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {savedMoves.map(move => (
                    <div key={move.id} className="bg-black/20 border border-blue-900/30 rounded-lg p-4 hover:border-blue-700/50 transition-colors">
                      <h3 className="font-serif text-xl text-blue-100">{move.title}</h3>
                      <p className="text-sm text-blue-200/60">
                        {new Date(move.createdAt.seconds * 1000).toLocaleString()} by {move.userEmail}
                      </p>
                      <div className="flex justify-between items-center mt-3 text-blue-100/80">
                        <span className="flex items-center">
                          <Clock className="mr-1 h-4 w-4" />
                          {formatTime(move.duration)}
                        </span>
                        <span className="flex items-center">
                          <Award className="mr-1 h-4 w-4" />
                          {move.moves.length} moves
                        </span>
                      </div>
                      <div className="flex justify-between mt-4">
                        <Button 
                          onClick={() => loadReplay(move.id)} 
                          className="bg-blue-900/80 hover:bg-blue-800 text-blue-100 border border-blue-700/50"
                          size="sm"
                        >
                         再生
                        </Button>
                        {move.userId === user?.uid && (
                          <Button 
                            onClick={() => deleteReplay(move.id)} 
                            variant="destructive" 
                            size="sm" 
                            className="bg-red-900/80 hover:bg-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(currentView === 'record' || currentView === 'replay') && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Button 
                    onClick={() => setCurrentView('list')} 
                    variant="ghost" 
                    className="text-blue-100 hover:bg-blue-900/50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-2xl font-serif text-blue-100">
                    {currentView === 'record' ? (isRecording ? 'Recording' : 'Recording Stopped') : 'Replaying'}
                  </h2>
                  <div className="text-lg text-blue-100">
                    <Clock className="inline-block mr-2 h-5 w-5" />
                    {formatTime(currentView === 'record' ? timer : (selectedReplay?.duration || 0))}
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className={`rounded-lg overflow-hidden shadow-2xl max-w-full w-full flex justify-center p-1 ${!isRecording && currentView === 'record' ? 'border-4 border-red-500' : ''}`}>
                    <Chessboard 
                      position={currentView === 'record' ? game.fen() : replayGame.fen()} 
                      onPieceDrop={currentView === 'record' && isRecording ? onDrop : () => false}
                      boardWidth={boardWidth}
                      customDarkSquareStyle={{ backgroundColor: '#1a237e' }}
                      customLightSquareStyle={{ backgroundColor: '#283593' }}
                      customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 4px rgba(66, 165, 245, 0.75)' }}
                      customPremoveDarkSquareStyle={{ backgroundColor: '#0d47a1' }}
                      customPremoveLightSquareStyle={{ backgroundColor: '#1565c0' }}
                      animationDuration={200}
                    />
                  </div>
                </div>

                <div className="flex justify-center space-x-3">
                  {currentView === 'record' ? (
                    isRecording ? (
                      <Button 
                        onClick={stopRecording} 
                        className="bg-red-900 hover:bg-red-800 text-blue-100 border border-red-800"
                      >
                        <StopCircle className="mr-2 h-5 w-5" /> Stop Recording
                      </Button>
                    ) : (
                      <Button 
                        onClick={startRecording} 
                        className="bg-green-900 hover:bg-green-800 text-blue-100 border border-green-800"
                      >
                        <PlayCircle className="mr-2 h-5 w-5" /> Resume Recording
                      </Button>
                    )
                  ) : (
                    <>
                      <Button 
                        onClick={replayPrevMove} 
                        disabled={currentReplayMove === 0}
                        className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-700 disabled:opacity-50"
                      >
                        <Rewind className="mr-2 h-5 w-5" /> Previous
                      </Button>
                      <Button 
                        onClick={replayNextMove}
                        disabled={!selectedReplay || currentReplayMove === selectedReplay.moves.length}
                        className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-700 disabled:opacity-50"
                      >
                        Next <FastForward className="ml-2 h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>

                {currentView === 'record' && (
                  <div className="flex items-center space-x-3">
                    <Input
                      type="text"
                      placeholder="Game Title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="flex-grow bg-black/20 border-blue-900/30 text-blue-100 placeholder:text-blue-100/50"
                    />
                    <Button 
                      onClick={saveMoves} 
                      className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-700"
                    >
                      <Save className="mr-2 h-5 w-5" /> Save
                    </Button>
                  </div>
                )}

                <div className="text-center text-lg text-blue-100">
                  {currentView === 'record' ? (
                    <p>Recording: Move {recordedMoves.length}</p>
                  ) : (
                    <p>Replay: Move {currentReplayMove} / {selectedReplay?.moves.length}</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}