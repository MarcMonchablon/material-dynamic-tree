import { Component, OnInit } from '@angular/core';
import { FoldersService } from '../../_services/folders.service';
import { UntypedFormControl } from '@angular/forms';

@Component({
  selector: 'app-folders',
  templateUrl: './folders.component.html',
  styleUrls: ['./folders.component.scss']
})
export class FoldersComponent implements OnInit {
  public treeRequired: boolean = false;
  public treeForm = new UntypedFormControl('');

  constructor(
    private foldersSrv: FoldersService,
  ) {}

  ngOnInit(): void {}

  onFolderSelected(val: string): void {
    console.group('[FoldersComponent] onFolderSelected');
    console.log('val: ', val);
    console.groupEnd();
  }
}
