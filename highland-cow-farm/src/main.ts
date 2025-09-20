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
import * as Progression from './game/progression';
import type { Options } from './types';

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
    default:
      break;
  }
});

const taskArea = TaskRush.getArea();
if (taskArea) {
  Progression.prepareMiniGames(taskArea);
}

let optionsReturnScreen: string = 'title';

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
  FarmUI.renderEvents(preview?.previewNotes || []);
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

initAudio();
const initialData = State.getData();
OptionsUI.update(initialData.options);
applyOptionEffects(initialData.options);
refreshFarm();
TitleUI.show();
