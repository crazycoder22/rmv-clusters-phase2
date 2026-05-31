import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import SignIn from "./auth/SignIn";
import Shell from "./layout/Shell";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import News from "./pages/News";
import MemoryGame from "./pages/MemoryGame";
import Wordle from "./pages/Wordle";
import Sudoku from "./pages/Sudoku";
import Game2048 from "./pages/Game2048";
import QuizJoin from "./pages/QuizJoin";
import QuizSession from "./pages/QuizSession";
import TambolaJoin from "./pages/TambolaJoin";
import TambolaSession from "./pages/TambolaSession";
import FantasyMatches from "./pages/FantasyMatches";
import FantasyMatch from "./pages/FantasyMatch";
import MemoryMulti from "./pages/MemoryMulti";
import MemoryMultiSession from "./pages/MemoryMultiSession";
import Guidelines from "./pages/Guidelines";
import Info from "./pages/Info";
import MorePage from "./pages/More";
import Faq from "./pages/Faq";
import Gallery from "./pages/Gallery";
import Videos from "./pages/Videos";
import SosGuidelines from "./pages/SosGuidelines";
import SosWarriors from "./pages/SosWarriors";
import Issues from "./pages/Issues";
import IssueNew from "./pages/IssueNew";
import IssueDetail from "./pages/IssueDetail";
import Community from "./pages/Community";
import CommunityPost from "./pages/CommunityPost";
import Polls from "./pages/Polls";
import PollDetail from "./pages/PollDetail";
import Visits from "./pages/Visits";
import Anagram from "./pages/Anagram";
import Stickers from "./pages/Stickers";
import AdminStickers from "./pages/AdminStickers";
import AdminEvents from "./pages/AdminEvents";
import AdminEventDetail from "./pages/AdminEventDetail";
import AdminMedals from "./pages/AdminMedals";
import AdminIssues from "./pages/AdminIssues";
import AdminVisits from "./pages/AdminVisits";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminAnnouncementEdit from "./pages/AdminAnnouncementEdit";
import AdminRoles from "./pages/AdminRoles";
import AdminVideos from "./pages/AdminVideos";
import AdminAds from "./pages/AdminAds";
import AdminResidents from "./pages/AdminResidents";
import AdminSos from "./pages/AdminSos";
import AdminTambola from "./pages/AdminTambola";
import AdminTambolaHost from "./pages/AdminTambolaHost";
import AdminQuiz from "./pages/AdminQuiz";
import AdminQuizHost from "./pages/AdminQuizHost";
import StepEventDetail from "./pages/StepEventDetail";
import StepLeaderboard from "./pages/StepLeaderboard";
import MySteps from "./pages/MySteps";
import Calendar from "./pages/Calendar";
import AdminCalendar from "./pages/AdminCalendar";
import Habits from "./pages/Habits";
import HabitDetail from "./pages/HabitDetail";
import Food from "./pages/Food";
import FoodMenuDetail from "./pages/FoodMenuDetail";
import FoodMenuEdit from "./pages/FoodMenuEdit";
import Parking from "./pages/Parking";
import ParkingSlotDetail from "./pages/ParkingSlotDetail";
import ParkingSlotEdit from "./pages/ParkingSlotEdit";
import Initiatives from "./pages/Initiatives";
import InitiativeDetail from "./pages/InitiativeDetail";
import InitiativeForm from "./pages/InitiativeForm";
import Referendums from "./pages/Referendums";
import ReferendumDetail from "./pages/ReferendumDetail";
import ReferendumForm from "./pages/ReferendumForm";
import Duties from "./pages/Duties";
import PushNotificationsMount from "./components/PushNotificationsMount";
import StepSyncMount from "./components/StepSyncMount";
import DeepLinksMount from "./components/DeepLinksMount";

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (status !== "signedIn") {
    return <SignIn />;
  }

  return (
    <HashRouter>
      <PushNotificationsMount />
      <StepSyncMount />
      <DeepLinksMount />
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/games" element={<Games />} />
          <Route path="/news" element={<News />} />
          <Route path="/memory" element={<MemoryGame />} />
          <Route path="/memory/multi" element={<MemoryMulti />} />
          <Route path="/memory/multi/:code" element={<MemoryMultiSession />} />
          <Route path="/wordle" element={<Wordle />} />
          <Route path="/sudoku" element={<Sudoku />} />
          <Route path="/2048" element={<Game2048 />} />
          <Route path="/quiz" element={<QuizJoin />} />
          <Route path="/quiz/:code" element={<QuizSession />} />
          <Route path="/tambola" element={<TambolaJoin />} />
          <Route path="/tambola/:code" element={<TambolaSession />} />
          <Route path="/fantasy" element={<FantasyMatches />} />
          <Route path="/fantasy/:matchId" element={<FantasyMatch />} />
          <Route path="/guidelines" element={<Guidelines />} />
          <Route path="/info" element={<Info />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/sos-guidelines" element={<SosGuidelines />} />
          <Route path="/sos-warriors" element={<SosWarriors />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/issues/new" element={<IssueNew />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<CommunityPost />} />
          <Route path="/polls" element={<Polls />} />
          <Route path="/polls/:id" element={<PollDetail />} />
          <Route path="/visits" element={<Visits />} />
          <Route path="/anagram" element={<Anagram />} />
          <Route path="/stickers" element={<Stickers />} />
          <Route path="/admin/stickers" element={<AdminStickers />} />
          <Route path="/admin/events" element={<AdminEvents />} />
          <Route path="/admin/events/:id" element={<AdminEventDetail />} />
          <Route path="/admin/medals" element={<AdminMedals />} />
          <Route path="/admin/issues" element={<AdminIssues />} />
          <Route path="/admin/visits" element={<AdminVisits />} />
          <Route path="/admin/announcements" element={<AdminAnnouncements />} />
          <Route
            path="/admin/announcements/new"
            element={<AdminAnnouncementEdit />}
          />
          <Route
            path="/admin/announcements/:id"
            element={<AdminAnnouncementEdit />}
          />
          <Route path="/admin/roles" element={<AdminRoles />} />
          <Route path="/admin/videos" element={<AdminVideos />} />
          <Route path="/admin/ads" element={<AdminAds />} />
          <Route path="/admin/residents" element={<AdminResidents />} />
          <Route path="/admin/sos" element={<AdminSos />} />
          <Route path="/admin/tambola" element={<AdminTambola />} />
          <Route path="/admin/tambola/:code" element={<AdminTambolaHost />} />
          <Route path="/admin/quiz" element={<AdminQuiz />} />
          <Route path="/admin/quiz/:code" element={<AdminQuizHost />} />
          <Route path="/steps/:id" element={<StepEventDetail />} />
          <Route path="/steps/:id/leaderboard" element={<StepLeaderboard />} />
          <Route path="/my-steps" element={<MySteps />} />
        <Route path="/parking" element={<Parking />} />
        <Route path="/parking/slots/new" element={<ParkingSlotEdit />} />
        <Route path="/parking/slots/:id/edit" element={<ParkingSlotEdit />} />
        <Route path="/parking/:id" element={<ParkingSlotDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/admin/calendar" element={<AdminCalendar />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/habits/:id" element={<HabitDetail />} />
          <Route path="/food" element={<Food />} />
          <Route path="/food/menus/new" element={<FoodMenuEdit />} />
          <Route path="/food/menus/:id/edit" element={<FoodMenuEdit />} />
          <Route path="/food/menus/:id" element={<FoodMenuDetail />} />
          <Route path="/initiatives" element={<Initiatives />} />
          <Route path="/initiatives/new" element={<InitiativeForm />} />
          <Route path="/initiatives/:id/edit" element={<InitiativeForm />} />
          <Route path="/initiatives/:id" element={<InitiativeDetail />} />
          <Route path="/referendums" element={<Referendums />} />
          <Route path="/referendums/new" element={<ReferendumForm />} />
          <Route path="/referendums/:id/edit" element={<ReferendumForm />} />
          <Route path="/referendums/:id" element={<ReferendumDetail />} />
          <Route path="/duties" element={<Duties />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
