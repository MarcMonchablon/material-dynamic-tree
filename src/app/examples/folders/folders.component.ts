import { Component, OnInit } from '@angular/core';
import { FoldersService } from '../../_services/folders.service';

@Component({
  selector: 'app-folders',
  templateUrl: './folders.component.html',
  styleUrls: ['./folders.component.scss']
})
export class FoldersComponent implements OnInit {

  constructor(
    private foldersSrv: FoldersService,
  ) {}

  ngOnInit(): void {
    this.foldersSrv.init();
  }
}
