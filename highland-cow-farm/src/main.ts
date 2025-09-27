import './styles/theme.css';

import { registerScreen, showScreen } from './core/screens';
import { initAudio, setEnabled, setVolumes, ensureAmbience, stopAmbience } from './core/audio';
import * as State from './core/state';
import * as TitleUI from './ui/title';
import * as OptionsUI from './ui/options';
import * as FarmUI from './ui/farm';
import * as StyleRoom from './ui/styleRoom';
import * as DecorRoom from './ui/decorRoom';
import * as TaskRush from './ui/taskRush';
import * as SummaryUI from './ui/summary';
import * as Journal from './ui/journal';
import * as Progression from './game/progression';
import type { Options, SeasonProgressSnapshot } from './types';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing app root');
}

const sections = app.querySelectorAll<HTMLElement>('[data-screen]');
sections.forEach(section => {
  const name = section.dataset.screen;
  if (!name) return;
  registerScreen(name, section);
  switch (name) {
    case 'title':
      TitleUI.init(section);
      break;
    case 'options':
      OptionsUI.init(section);
      break;
    case 'farm':
      FarmUI.init(section);
      break;
    case 'style':
      StyleRoom.init(section);
      break;
    case 'decor':
      DecorRoom.init(section);
      break;
    case 'task':
      TaskRush.init(section);
      break;
    case 'summary':
      SummaryUI.init(section);
      break;
    case 'journal':
      Journal.init(section);
      break;
    default:
      break;
  }
});

const taskArea = TaskRush.getArea();
if (taskArea) {
  Progression.prepareMiniGames(taskArea);
}

let optionsReturnScreen: string = 'title';
let currentSeasonClass: string | null = null;

function updateSeasonStyles(season?: SeasonProgressSnapshot | null): void {
  const body = document.body;
  if (!body) return;
  if (currentSeasonClass) {
    body.classList.remove(currentSeasonClass);
    currentSeasonClass = null;
  }
  if (season?.season?.id) {
    currentSeasonClass = `season-${season.season.id}`;
    body.classList.add(currentSeasonClass);
    body.setAttribute('data-season', season.season.id);
  } else {
    body.removeAttribute('data-season');
  }
}

function applyOptionEffects(options: Options): void {
  OptionsUI.applyOptions(options);
  setEnabled(options.audioOn);
  setVolumes({
    effects: options.effectsVolume,
    ambience: options.ambienceVolume,
    master: options.masterVolume
  });
  if (options.audioOn) {
    ensureAmbience();
  } else {
    stopAmbience();
  }
}

function refreshFarm(): void {
  const data = State.getData();
  FarmUI.renderHerd(data.cows);
  FarmUI.renderPantry(State.getUnlocks('foods'));
  FarmUI.renderDecor(State.getDecorLayout());
  FarmUI.renderAchievements(State.getAchievements());
  const preview = Progression.getPreviewPlan(data);
  const seasonContext = preview?.season || State.getSeasonContext(data.day);
  updateSeasonStyles(seasonContext);
  FarmUI.renderEvents(preview?.previewNotes || [], seasonContext);
  if (data.options.audioOn) {
    ensureAmbience();
  } else {
    stopAmbience();
  }
}

TitleUI.configureTitleHandlers({
  onStart() {
    refreshFarm();
    FarmUI.show();
  },
  onOptions() {
    optionsReturnScreen = 'title';
    OptionsUI.update(State.getData().options);
    OptionsUI.show();
  },
  onReset() {
    const data = State.reset();
    OptionsUI.update(data.options);
    applyOptionEffects(data.options);
    refreshFarm();
    TitleUI.show();
  }
});

FarmUI.configureFarmHandlers({
  onStartDay() {
    Progression.startDay();
  },
  onOptions() {
    optionsReturnScreen = 'farm';
    OptionsUI.update(State.getData().options);
    OptionsUI.show();
  },
  onEditCow(cowId) {
    const cow = State.getCow(cowId);
    if (!cow) return;
    StyleRoom.show(cow, State.getUnlocks('accessories'));
  },
  onManageDecor() {
    DecorRoom.show(State.getUnlocks('decor'), State.getDecorLayout());
  },
  onOpenJournal() {
    Journal.refresh();
    Journal.show();
  }
});

StyleRoom.configureStyleHandlers({
  onBack() {
    refreshFarm();
  },
  onClear(cowId) {
    State.setCowAccessories(cowId, []);
    refreshFarm();
    return State.getCow(cowId) || null;
  },
  onRandomise(cowId) {
    const updated = State.randomiseAccessories(cowId);
    refreshFarm();
    return updated || null;
  },
  onToggle(cowId, accessory) {
    State.toggleCowAccessory(cowId, accessory);
    refreshFarm();
    return State.getCow(cowId) || null;
  }
});

DecorRoom.configureDecorHandlers({
  onSave(layout) {
    State.setDecorLayout(layout);
    FarmUI.show();
    refreshFarm();
  },
  onBack() {
    FarmUI.show();
    refreshFarm();
  }
});

OptionsUI.configureOptionsHandlers({
  onBack() {
    if (optionsReturnScreen === 'farm') {
      FarmUI.show();
      refreshFarm();
    } else if (optionsReturnScreen === 'task') {
      showScreen('task');
    } else {
      TitleUI.show();
    }
  },
  onChange(partial) {
    State.setOption(partial);
    const options = State.getData().options;
    OptionsUI.update(options);
    applyOptionEffects(options);
  }
});

SummaryUI.configureSummaryHandlers({
  onContinue() {
    FarmUI.show();
    refreshFarm();
    State.saveNow();
  }
});

TaskRush.configureTaskHandlers({
  onContinue() {
    // Placeholder for future manual progression controls.
  }
});

Journal.configureJournalHandlers({
  onBack() {
    FarmUI.show();
    refreshFarm();
  },
  onDataChanged() {
    refreshFarm();
  }
});

initAudio();
const initialData = State.getData();
OptionsUI.update(initialData.options);
applyOptionEffects(initialData.options);
refreshFarm();
TitleUI.show();
