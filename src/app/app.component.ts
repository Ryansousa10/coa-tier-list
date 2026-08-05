import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TooltipIconFixService } from './tooltip-icon-fix.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  // injetado aqui só pra iniciar a observação do tooltip assim que o app sobe
  constructor(private tooltipIconFix: TooltipIconFixService) {}
}
