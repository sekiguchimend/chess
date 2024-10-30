'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayCircle, StopCircle, Rewind, FastForward, Save, ChevronLeft, Clock, Award, Trash2, LogOut } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import './mobile.css';

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
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const loadSavedMoves = useCallback(async () => {
    if (!user) return;
    
    try {
      const movesCollection = collection(db, 'chessMoves');
      const userMovesQuery = query(movesCollection, where('userId', '==', user.uid));
      const movesSnapshot = await getDocs(userMovesQuery);
      const movesList = movesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavedMove[];
      setSavedMoves(movesList);
    } catch (error) {
      console.error("Error loading saved moves:", error);
      toast.error("保存された対局の読み込みに失敗しました");
    }
  }, [user]);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        toast.success("アカウントを作成しました");
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
        toast.success("ログインしました");
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error(isRegistering ? "アカウント作成に失敗しました" : "ログインに失敗しました");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("ログアウトしました");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("ログアウトに失敗しました");
    }
  };

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setIsTimerRunning(false);
    toast.success("録画を停止しました");
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
        toast.success("チェックメイト！");
        stopRecording();
      } else if (game.isDraw()) {
        stopRecording();
      }

      return true;
    } catch (error) {
      console.error("Invalid move:", error);
      toast.error("無効な手です");
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
    toast.success("録画を開始しました");
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
      toast.error('ログインが必要です');
      return;
    }
    if (title.trim() === '') {
      toast.error('タイトルを入力してください');
      return;
    }
    try {
      await addDoc(collection(db, 'chessMoves'), {
        title: title,
        moves: recordedMoves,
        createdAt: new Date(),
        duration: timer,
        userId: user.uid
      });
      setTitle('');
      loadSavedMoves();
      setCurrentView('list');
      toast.success("対局を保存しました");
    } catch (e) {
      console.error('Error adding document: ', e);
      toast.error("対局の保存に失敗しました");
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
        toast.error("対局データが見つかりません");
      }
    } catch (error) {
      console.error("Error loading replay:", error);
      toast.error("対局の読み込みに失敗しました");
    }
  }, []);

  const deleteReplay = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'chessMoves', id));
      toast.success("対局を削除しました");
      loadSavedMoves();
    } catch (error) {
      console.error("Error deleting replay:", error);
      toast.error("対局の削除に失敗しました");
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

  return (
    <div className="min-h-screen bg-[#1a0f00] p-8">
      <Toaster position="top-center" />
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8 relative">
          <h1 className="text-4xl font-serif text-amber-100 mb-2 tracking-wide">チェスマスター</h1>
          <p className="text-amber-200/80 font-light">対局を録画・再生</p>
          {user && (
            <div className="absolute right-0 top-0 flex items-center gap-2 text-amber-100">
              <span className="text-sm">{user.email}</span>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="text-amber-100 hover:bg-amber-900/50"
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
            className="bg-black/40 backdrop-blur-sm rounded-lg border border-amber-900/30 p-8"
          >
            {currentView === 'auth' && (
              <div className="max-w-md mx-auto space-y-6">
                <h2 className="text-2xl font-serif text-amber-100 text-center mb-6">
                  {isRegistering ? 'アカウント作成' : 'ログイン'}
                </h2>
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="メールアドレス"
                      value={authForm.email}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                      className="bg-black/20 border-amber-900/30 text-amber-100 placeholder:text-amber-100/50"
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder="パスワード"
                      value={authForm.password}
                      onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                      className="bg-black/20 border-amber-900/30 text-amber-100 placeholder:text-amber-100/50"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-amber-900 hover:bg-amber-800 text-amber-100 border border-amber-700"
                  >
                    {isRegistering ? 'アカウント作成' : 'ログイン'}
                  </Button>
                </form>
                <Button
                  variant="ghost"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="w-full text-amber-100 hover:bg-amber-900/50"
                >
                  {isRegistering ? 'ログインする' : 'アカウントを作成する'}
                </Button>
              </div>
            )}

            {currentView === 'list' && (
              <div className="space-y-6">
                <Button 
                  onClick={startRecording} 
                  className="w-full bg-amber-900 hover:bg-amber-800 text-amber-100 border border-amber-700 shadow-lg transition-all duration-200"
                >
                  <PlayCircle className="mr-2 h-5 w-5" /> 新規録画開始
                </Button>
                <h2 className="text-2xl font-serif text-amber-100 border-b border-amber-900/50 pb-2">保存された対局</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {savedMoves.map(move => (
                    <div key={move.id} className="bg-black/20 border border-amber-900/30 rounded-lg p-4 hover:border-amber-700/50 transition-colors">
                      <h3 className="font-serif text-xl text-amber-100">{move.title}</h3>
                      <p className="text-sm text-amber-200/60">{new Date(move.createdAt.seconds * 1000).toLocaleString()}</p>
                      <div className="flex justify-between items-center mt-3 text-amber-100/80">
                        <span className="flex items-center">
                          <Clock className="mr-1 h-4 w-4" />
                          {formatTime(move.duration)}
                        </span>
                        <span className="flex items-center">
                          <Award className="mr-1 h-4 w-4" />
                          {move.moves.length} 手
                        </span>
                      </div>
                      <div className="flex justify-between mt-4">
                        <Button 
                          onClick={() => loadReplay(move.id)} 
                          className="bg-amber-900/80 hover:bg-amber-800 text-amber-100 border border-amber-700/50"
                          size="sm"
                        >
                          再生
                        </Button>
                        <Button 
                          onClick={() => deleteReplay(move.id)} 
                          variant="destructive" 
                          size="sm" 
                          className="bg-red-900/80 hover:bg-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                    className="text-amber-100 hover:bg-amber-900/50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-2xl font-serif text-amber-100">
                    {currentView === 'record' ? '録画中' : '再生中'}
                  </h2>
                  <div className="text-lg text-amber-100">
                    <Clock className="inline-block mr-2 h-5 w-5" />
                    {formatTime(currentView === 'record' ? timer : (selectedReplay?.duration || 0))}
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="rounded-lg overflow-hidden shadow-2xl">
                    <Chessboard 
                      position={currentView === 'record' ? game.fen() : replayGame.fen()} 
                      onPieceDrop={currentView === 'record' ? onDrop : () => false}
                      boardWidth={500}
                      customDarkSquareStyle={{ backgroundColor: '#4b2810' }}
                      customLightSquareStyle={{ backgroundColor: '#deb887' }}
                      customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 4px rgba(218, 165, 32, 0.75)' }}
                      customPremoveDarkSquareStyle={{ backgroundColor: '#3d2008' }}
                      customPremoveLightSquareStyle={{ backgroundColor: '#be8f60' }}
                      animationDuration={200}
                    />
                  </div>
                </div>

                <div className="flex justify-center space-x-3">
                  {currentView === 'record' ? (
                    <Button 
                      onClick={stopRecording} 
                      className="bg-red-900 hover:bg-red-800 text-amber-100 border border-red-800"
                    >
                      <StopCircle className="mr-2 h-5 w-5" /> 録画停止
                    </Button>
                  ) : (
                    <>
                      <Button 
                        onClick={replayPrevMove} 
                        disabled={currentReplayMove === 0}
                        className="bg-amber-900 hover:bg-amber-800 text-amber-100 border border-amber-700 disabled:opacity-50"
                      >
                        <Rewind className="mr-2 h-5 w-5" /> 前の手
                      </Button>
                      <Button 
                        onClick={replayNextMove}
                        disabled={!selectedReplay || currentReplayMove === selectedReplay.moves.length}
                        className="bg-amber-900 hover:bg-amber-800 text-amber-100 border border-amber-700 disabled:opacity-50"
                      >
                        次の手 <FastForward className="ml-2 h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>

                {currentView === 'record' && (
                  <div className="flex items-center space-x-3">
                    <Input
                      type="text"
                      placeholder="対局のタイトル"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="flex-grow bg-black/20 border-amber-900/30 text-amber-100 placeholder:text-amber-100/50"
                    />
                    <Button 
                      onClick={saveMoves} 
                      className="bg-amber-900 hover:bg-amber-800 text-amber-100 border border-amber-700"
                    >
                      <Save className="mr-2 h-5 w-5" /> 保存
                    </Button>
                  </div>
                )}

                <div className="text-center text-lg text-amber-100">
                  {currentView === 'record' ? (
                    <p>現在録画中: {recordedMoves.length} 手目</p>
                  ) : (
                    <p>再生中: {currentReplayMove} / {selectedReplay?.moves.length} 手目</p>
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